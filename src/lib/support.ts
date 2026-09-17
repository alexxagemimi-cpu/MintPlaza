/**
 * Support constants, in a plain module on purpose.
 *
 * A file marked "use server" may only export async functions — every other
 * export is a build error, because Next has to be able to treat each one as a
 * callable server endpoint. These two are values the client needs as well:
 * the composer counts against the same limit the table enforces, and the email
 * address appears under the box and on the signed-out notice. So they live
 * here, where both sides can read them, and src/lib/actions/support.ts imports
 * them like anything else.
 */

/** The fallback for anybody who cannot sign in — which is exactly the person
 *  the composer will not work for, so it is never hidden behind a menu. */
export const SUPPORT_EMAIL = "Albertwhitestroke@gmail.com";

/** Matches the CHECK on support_messages.body, so the textarea and the table
 *  cannot disagree about what fits. */
export const MAX_SUPPORT_LENGTH = 2000;
