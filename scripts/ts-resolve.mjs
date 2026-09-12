/**
 * Lets `node --experimental-strip-types` follow this project's extensionless
 * imports. Next.js resolves `./values` to `values.ts` through its bundler;
 * plain Node does not, so the hook next to this file fills the gap. It exists
 * only so `npm run proof` can run the real modules rather than a copy of them.
 */
import { register } from "node:module";

register(new URL("./ts-resolve-hook.mjs", import.meta.url).href);
