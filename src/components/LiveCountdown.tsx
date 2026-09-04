"use client";

import { useEffect, useState } from "react";

/**
 * How long a listing has left.
 *
 * Rendered on the server first from the same timestamp, so the first paint is
 * correct and there is no hydration mismatch, then ticked in the browser once a
 * minute. Once a minute rather than once a second on purpose: nobody needs to
 * watch seconds drain, and a page of per-second timers is a page of wasted
 * battery on the phone this is mostly read on.
 */
export function LiveCountdown({
  expiresAt,
  initial,
}: {
  /** Epoch milliseconds. */
  expiresAt: number;
  /** What the server already rendered, so the two agree before hydration. */
  initial: string;
}) {
  const [copy, setCopy] = useState(initial);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 60_000));
      if (left <= 0) setCopy("Expired");
      else if (left < 60) setCopy(`${left}m`);
      else setCopy(`${Math.floor(left / 60)}h ${left % 60}m`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <>{copy}</>;
}
