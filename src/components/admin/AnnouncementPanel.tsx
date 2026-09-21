"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAnnouncement,
  setAnnouncementActive,
  type AnnouncementRow,
} from "@/lib/admin/actions";

/**
 * Writing the thing every visitor sees.
 *
 * Laid out in the order the question is actually asked — what is it called,
 * what does it say, is there a picture, how long is it up — with a preview
 * underneath that is the real popup's typography rather than an approximation.
 * This is the one screen on the site where getting it wrong is visible to
 * everybody at once, so seeing it before pressing Post matters more here than
 * anywhere else in the panel.
 *
 * Nothing is deleted. "End it now" sets it inactive: deleting the row would
 * take every "don't show again" with it.
 */

const dayCopy = (n: number) => (n === 1 ? "1 day" : `${n} days`);

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint && <span className="mt-0.5 block text-[0.75rem] text-ink-faint">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const input =
  "w-full rounded-[var(--radius-inner)] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint";

export function AnnouncementPanel({ rows }: { rows: AnnouncementRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "video" | "">("");
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function reset() {
    setEditing(null); setTitle(""); setBody("");
    setMediaUrl(""); setMediaKind(""); setDays(7);
    setError(null);
  }

  function load(r: AnnouncementRow) {
    setEditing(r.id);
    setTitle(r.title);
    setBody(r.body);
    setMediaUrl(r.media_url ?? "");
    setMediaKind(r.media_kind ?? "");
    setDays(Math.max(1, Math.round(
      (new Date(r.expires_at).getTime() - Date.now()) / 86_400_000)));
    setError(null); setNote(null);
  }

  function post() {
    setError(null); setNote(null);
    start(async () => {
      const r = await saveAnnouncement({
        id: editing ?? undefined,
        title, body, mediaUrl, mediaKind, days,
      });
      if (!r.ok) { setError(r.error); return; }
      setNote(editing ? "Updated. The clock restarted from now." : "Posted. Everyone sees it on their next visit.");
      reset();
      router.refresh();
    });
  }

  function toggle(r: AnnouncementRow) {
    setError(null); setNote(null);
    start(async () => {
      const res = await setAnnouncementActive(r.id, !r.is_active);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-[1.125rem] font-bold tracking-[-0.025em] text-ink">
        Announcements
      </h2>
      <p className="mt-1 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-mute">
        One message, over the whole site, for everybody — signed in or not. Only
        the newest live one is shown, and each player can put it away for the
        visit or for good.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass-quiet rounded-[var(--radius-panel)] p-4">
          <div className="grid gap-3">
            <Field label="Title" hint="Shown large and in green.">
              <input
                className={input}
                value={title}
                maxLength={120}
                placeholder="Trading is open"
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field label="Description" hint="Plain text. Line breaks are kept.">
              <textarea
                className={`${input} min-h-[7rem] resize-y`}
                value={body}
                maxLength={4000}
                placeholder="What you want everyone to know."
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>

            <Field
              label="Attachment"
              hint="Optional. A direct https:// link to a photo or video file."
            >
              <input
                className={input}
                value={mediaUrl}
                placeholder="https://…"
                onChange={(e) => setMediaUrl(e.target.value)}
              />
            </Field>

            {mediaUrl.trim() !== "" && (
              <div className="flex gap-2">
                {(["image", "video"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMediaKind(k)}
                    aria-pressed={mediaKind === k}
                    className={`rounded-full border px-4 py-2 text-[0.8125rem] font-bold transition-colors ${
                      mediaKind === k
                        ? "border-ink bg-ink text-surface"
                        : "border-line bg-surface text-ink-mute hover:border-mint"
                    }`}
                  >
                    {k === "image" ? "Photo" : "Video"}
                  </button>
                ))}
              </div>
            )}

            <Field label="How many days" hint="1 to 365. It disappears on its own after that.">
              <input
                type="number"
                min={1}
                max={365}
                className={input}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </Field>

            {error && <p role="alert" className="text-[0.8125rem] text-bad">{error}</p>}
            {note && <p className="text-[0.8125rem] text-mint">{note}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={post}
                disabled={busy || !title.trim() || !body.trim()}
                className="pill pill-mint flex-1 justify-center py-3 text-[0.9375rem] disabled:opacity-40"
              >
                {busy ? "Saving…" : editing ? "Update" : `Post for ${dayCopy(days || 1)}`}
              </button>
              {editing && (
                <button type="button" onClick={reset} className="pill pill-ghost px-5 py-3 text-[0.875rem]">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---- what a player will actually see ---- */}
        <div className="glass-quiet rounded-[var(--radius-panel)] p-4">
          <p className="label">Preview</p>
          {!title.trim() && !body.trim() ? (
            <p className="mt-3 text-[0.875rem] text-ink-faint">
              Type a title and a description and it appears here, in the
              typography a player sees.
            </p>
          ) : (
            <div className="mt-3 rounded-[var(--radius-inner)] border border-line bg-surface p-5">
              <p className="label">Announcement</p>
              <h3 className="mt-2 text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em] text-mint">
                {title || "Your title"}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">
                {body || "Your description."}
              </p>
              {mediaUrl.trim() !== "" && mediaKind !== "" && (
                <p className="mt-3 font-mono text-[0.6875rem] text-ink-faint">
                  + {mediaKind === "video" ? "VIDEO" : "PHOTO"} ATTACHMENT
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <span className="pill pill-ghost flex-1 justify-center py-2.5 text-[0.8125rem]">
                  Don&rsquo;t show again
                </span>
                <span className="pill pill-mint flex-1 justify-center py-2.5 text-[0.875rem]">
                  Okay
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- what has been posted ---- */}
      {rows.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-inner)] border border-line bg-surface px-4 py-3"
            >
              <span
                className={`font-mono text-[0.5625rem] font-bold tracking-[0.1em] ${
                  r.live ? "text-mint" : "text-ink-faint"
                }`}
              >
                {r.live ? "LIVE" : r.is_active ? "EXPIRED" : "ENDED"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-ink">
                {r.title}
              </span>
              <span className="font-mono text-[0.6875rem] text-ink-faint">
                {r.dismissals} hidden
              </span>
              <button
                type="button"
                onClick={() => load(r)}
                className="pill pill-ghost px-4 py-1.5 text-[0.8125rem]"
              >
                Edit
              </button>
              {r.live && (
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  disabled={busy}
                  className="pill pill-ghost px-4 py-1.5 text-[0.8125rem]"
                >
                  End it now
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
