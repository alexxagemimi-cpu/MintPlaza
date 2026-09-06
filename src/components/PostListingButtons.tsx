"use client";

import { useState } from "react";
import { PostListing } from "./PostListing";
import type { Section } from "@/lib/sessions";

/** The two ways in, and the form they open. */
export function PostListingButtons({
  gameSlug, gameName, section = "services",
}: { gameSlug: string; gameName: string; section?: Section }) {
  const [open, setOpen] = useState<null | "request" | "offer">(null);

  return (
    <>
      {/* Recruitment has one direction only.
          A crew call is not two-sided the way a favour is: the person who posts
          is the person starting it, and everybody else answers by voting. An
          "I'll join" post would be somebody advertising availability into the
          void with no raid attached — a post nobody can act on. */}
      <div className="flex gap-2">
        {section === "recruit" ? (
          <button type="button" onClick={() => setOpen("request")}
                  className="pill pill-mint py-2.5 text-[0.8125rem]">
            Start a crew
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setOpen("request")}
                    className="pill pill-ghost py-2.5 text-[0.8125rem]">
              I need help
            </button>
            <button type="button" onClick={() => setOpen("offer")}
                    className="pill pill-mint py-2.5 text-[0.8125rem]">
              I can help
            </button>
          </>
        )}
      </div>
      {open && (
        <PostListing gameSlug={gameSlug} gameName={gameName} section={section}
                     onClose={() => setOpen(null)} />
      )}
    </>
  );
}
