"use client";

import { useState } from "react";
import { PostListing } from "./PostListing";

/** The two ways in, and the form they open. */
export function PostListingButtons({
  gameSlug, gameName,
}: { gameSlug: string; gameName: string }) {
  const [open, setOpen] = useState<null | "request" | "offer">(null);

  return (
    <>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen("request")}
                className="pill pill-ghost py-2.5 text-[0.8125rem]">
          I need help
        </button>
        <button type="button" onClick={() => setOpen("offer")}
                className="pill pill-mint py-2.5 text-[0.8125rem]">
          I can help
        </button>
      </div>
      {open && (
        <PostListing gameSlug={gameSlug} gameName={gameName} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
