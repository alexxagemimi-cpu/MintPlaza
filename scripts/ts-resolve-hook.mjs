import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\.[a-z]+$/.test(spec)) {
    try {
      const base = new URL(spec, ctx.parentURL);
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        if (existsSync(fileURLToPath(base.href + ext))) return next(spec + ext, ctx);
      }
    } catch { /* fall through */ }
  }
  return next(spec, ctx);
}
