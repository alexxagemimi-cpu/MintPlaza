"use client";

import { useState, useTransition } from "react";
import { resolveReport, type AdminReport } from "@/lib/admin/actions";

/**
 * Player reports.
 *
 * The site tells everybody to record before they hand anything over. That
 * advice is only worth giving if the recording has somewhere to go and somebody
 * who looks at it, so this is the other half of the report button.
 *
 * Two decisions worth stating.
 *
 * The evidence link is shown as **text with a copy button, never as a live
 * link.** Everything in this panel was typed by a stranger, and a one-tap link
 * from a report straight into whatever a reporter chose is the one place on
 * this site where the owner is invited to trust a stranger's URL. Copying it
 * costs a second and means the destination is read before it is visited.
 *
 * And a report keeps the subject in **words**, captured when it was filed.
 * Listings are hard-deleted when their window closes, so an id alone would age
 * into a report about nothing within two hours — exactly when somebody finally
 * got round to reading it.
 */

const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  open:      { fg: "#A8501E", bg: "#FBEDE3" },
  actioned:  { fg: "#1F7A54", bg: "#E6F4EC" },
  dismissed: { fg: "#6B7A74", bg: "#EEF2F0" },
};

function when(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Evidence({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-[10px] border border-line bg-fill px-3 py-2">
      <p className="font-mono text-[0.5rem] tracking-[0.09em] text-ink-faint">
        THEIR RECORDING
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-[0.75rem] text-ink-soft">{url}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch { /* clipboard can be blocked; the text is selectable anyway */ }
          }}
          className="pill pill-ghost shrink-0 px-2.5 py-1 text-[0.6875rem]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 text-[0.625rem] leading-relaxed text-ink-faint">
        Copy and paste it yourself — a stranger typed this, so read where it goes
        before you go there.
      </p>
    </div>
  );
}

function ReportCard({ report, onDone }: { report: AdminReport; onDone: (id: string) => void }) {
  const [note, setNote] = useState(report.admin_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const style = STATUS_STYLE[report.status] ?? STATUS_STYLE.open;

  function decide(status: "actioned" | "dismissed") {
    setError(null);
    start(async () => {
      const result = await resolveReport(report.id, status, note.trim() || undefined);
      if (!result.ok) { setError(result.error); return; }
      onDone(report.id);
    });
  }

  return (
    <li className="glass rounded-[var(--radius-inner)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-bold tracking-[0.08em]"
          style={{ color: style.fg, background: style.bg }}
        >
          {report.status.toUpperCase()}
        </span>
        <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
          {report.subject_type.toUpperCase()} · {when(report.created_at)}
        </span>
      </div>

      <p className="mt-2 text-[1rem] font-bold tracking-[-0.02em] text-ink">
        {report.reason}
      </p>

      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
        <span className="text-ink-mute">About: </span>
        {report.subject_label ?? <span className="text-ink-faint">no longer on record</span>}
      </p>

      <p className="mt-1 text-[0.8125rem] text-ink-mute">
        <span className="text-ink-faint">Reported by </span>
        <b className="text-ink">{report.reporter_username ?? "a deleted account"}</b>
        {report.reporter_roblox_id && (
          <span className="font-mono text-[0.6875rem] text-ink-faint">
            {" "}· Roblox {report.reporter_roblox_id}
          </span>
        )}
      </p>

      {report.detail && (
        <p className="mt-2 rounded-[10px] bg-fill px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-soft">
          &ldquo;{report.detail}&rdquo;
        </p>
      )}

      {report.evidence_url
        ? <Evidence url={report.evidence_url} />
        : (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-faint">
            No recording attached — this is one person&rsquo;s word.
          </p>
        )}

      {report.status === "open" && (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="What you did about it — for you, later"
            aria-label="Note on this report"
            className="mt-3 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[0.875rem] text-ink outline-none focus:border-mint"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => decide("actioned")} disabled={busy}
                    className="pill pill-mint flex-1 py-2 text-[0.875rem] disabled:opacity-50">
              Acted on it
            </button>
            <button type="button" onClick={() => decide("dismissed")} disabled={busy}
                    className="pill pill-ghost flex-1 py-2 text-[0.875rem] disabled:opacity-50">
              Nothing to do
            </button>
          </div>
        </>
      )}

      {report.status !== "open" && report.admin_note && (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-faint">
          Your note: {report.admin_note}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-bad">{error}</p>
      )}
    </li>
  );
}

export function ReportsPanel({ reports }: { reports: readonly AdminReport[] }) {
  const [done, setDone] = useState<string[]>([]);
  const showing = reports.filter((r) => !done.includes(r.id));

  return (
    <section className="mt-7">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
          Player reports
        </h2>
        <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
          {showing.length} OPEN
        </span>
      </div>
      <p className="mb-4 max-w-[62ch] text-[0.8125rem] leading-relaxed text-ink-mute">
        Everything players have flagged, newest first. Deal with these — a report
        button nobody answers teaches people the site does not act, and then they
        stop telling you anything.
      </p>

      {showing.length === 0 ? (
        <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-12 text-center">
          <p className="text-[1rem] font-bold tracking-[-0.02em] text-ink">
            Nothing waiting
          </p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[0.875rem] leading-relaxed text-ink-mute">
            Reports appear here the moment somebody files one.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {showing.map((r) => (
            <ReportCard key={r.id} report={r} onDone={(id) => setDone((p) => [...p, id])} />
          ))}
        </ul>
      )}
    </section>
  );
}
