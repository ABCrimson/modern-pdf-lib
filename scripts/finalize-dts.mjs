/**
 * Second half of the two-pass build (see tsdown.config.ts).
 *
 * The value bundle is emitted to `dist/` with `dts: false` (clean, importable).
 * The declarations are emitted to `dist-types/` with `dts: true`. This script
 * copies the declaration files (`.d.mts`, `.d.cts`, and their sourcemaps) from
 * `dist-types/` into `dist/`, preserving subdirectories (e.g. `cli/`), then
 * removes the temp dir. The declaration *graph* (chunked `.d.mts` files) is
 * self-contained and references only other `.d.*` files, so it composes
 * correctly with the independently-hashed value `.mjs`/`.cjs` chunks.
 */
import { cpSync, rmSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const SRC = 'dist-types';
const DEST = 'dist';

if (!existsSync(SRC)) {
  console.error(`finalize-dts: expected "${SRC}/" from the dts pass — did tsdown run both configs?`);
  process.exit(1);
}

const DECL = /\.d\.(mts|cts)(\.map)?$/;

let copied = 0;
/** Recursively copy only declaration files, preserving structure. */
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walk(abs);
    } else if (DECL.test(name)) {
      const rel = relative(SRC, abs);
      const target = join(DEST, rel);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(abs, target);
      copied++;
    }
  }
}

walk(SRC);
rmSync(SRC, { recursive: true, force: true });

if (copied === 0) {
  console.error('finalize-dts: copied 0 declaration files — the dts pass produced no .d.mts/.d.cts.');
  process.exit(1);
}
console.log(`finalize-dts: copied ${copied} declaration files into ${DEST}/ and removed ${SRC}/.`);
