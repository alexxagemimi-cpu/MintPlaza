/**
 * Contacts — the people you actually played with.
 *
 * ---------------------------------------------------------------------------
 * The one rule that shapes everything else
 * ---------------------------------------------------------------------------
 *
 * There is no way to add a stranger. No username search, no invite link, no
 * "people you may know". The only door into somebody's contact list is having
 * finished a deal with them, which means the site cannot be used to message a
 * person who never agreed to be in a room with you.
 *
 * That is not a limitation to be lifted later. It is the feature. Every scam
 * and every piece of harassment on a site like this starts with an unsolicited
 * message, and a matching site for teenagers that lets anybody message anybody
 * has built the vector before it has built the product. Requiring a completed
 * deal costs a real user nothing — they were just in a raid with the person —
 * and costs somebody hunting for targets everything.
 *
 * ---------------------------------------------------------------------------
 * Why suggestions expire
 * ---------------------------------------------------------------------------
 *
 * A suggestion is not stored. It is read off the deal itself, so when the
 * listing is hard-deleted at the end of its window the suggestion goes with it
 * — no cron job, no second cleanup to forget to write, and no way for the two
 * to disagree. If you did not decide within the window, the answer was no.
 *
 * The card says so out loud rather than letting the row quietly vanish, because
 * a list that empties itself without warning reads as a bug.
 */

import { LIVE_WINDOW_MINUTES } from "./sessions";

/** How long a suggestion lasts: exactly as long as the deal it came from. */
export const SUGGESTION_WINDOW_MINUTES = LIVE_WINDOW_MINUTES;

export interface Person {
  username: string;
  avatarUrl?: string;
  online: boolean;
}

/**
 * Somebody you just finished a deal with, offered once.
 *
 * `alongside` is the rest of the team. It is here because "add this person?"
 * is a much easier question to answer when you can see they were the other
 * four people on the Leviathan boat with you twenty minutes ago.
 */
export interface ContactSuggestion {
  id: string;
  person: Person;
  /** The template the deal was for, named the way the board named it. */
  serviceId: string;
  /** Everyone else who was on it, so the memory has something to hook on. */
  alongside: readonly string[];
  /** Minutes since the deal locked in. */
  metMinutesAgo: number;
  isDemo?: boolean;
}

export interface Contact {
  id: string;
  person: Person;
  /** What you did together, kept as the reason this person is in the list. */
  metServiceId: string;
  metDaysAgo: number;
  lastMessage?: string;
  lastMessageMinutesAgo?: number;
  unread: number;
  isDemo?: boolean;
}

export interface DirectMessage {
  id: string;
  /** True when you wrote it. */
  mine: boolean;
  text: string;
  minutesAgo: number;
  isDemo?: boolean;
}

/** Minutes a suggestion has left before it clears itself. */
export function suggestionMinutesLeft(s: ContactSuggestion): number {
  return Math.max(0, SUGGESTION_WINDOW_MINUTES - s.metMinutesAgo);
}

/** "1h 40m" / "12m", matching the countdown on the boards. */
export function shortLeft(minutes: number): string {
  if (minutes <= 0) return "gone";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function agoLabel(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * What a message may contain.
 *
 * Deliberately short. This is a place to say "I'm on, which server" — not a
 * place to negotiate something elaborate, and a small limit is the cheapest
 * discouragement there is for a pasted scam script.
 */
export const MESSAGE_MAX = 300;
