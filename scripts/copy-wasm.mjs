/**
 * Copy the wasm-pack output of every Rust crate into `dist/wasm/<crate>/` so
 * the published tarball ships it (`files: ["dist/wasm/**"]`, exports
 * `"./wasm/*": "./dist/wasm/*"`).
 *
 * Input:  src/wasm/<crate>/pkg/modern_pdf_<crate>{.js,.d.ts,_bg.wasm,_bg.wasm.d.ts}
 * Output: dist/wasm/<crate>/<same files>
 *
 * Usage: `pnpm run copy:wasm` (after `pnpm run build:wasm` and `pnpm run build`;
 * `build` cleans `dist/`, so this must run after it). Exits non-zero and names
 * every crate whose `pkg/modern_pdf_<crate>_bg.wasm` is missing.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CRATES = ['libdeflate', 'png', 'ttf', 'shaping', 'jbig2', 'jpeg'];

const missing = CRATES.filter(
  (crate) => !existsSync(join('src', 'wasm', crate, 'pkg', `modern_pdf_${crate}_bg.wasm`)),
);
if (missing.length > 0) {
  console.error(
    `copy-wasm: missing src/wasm/<crate>/pkg/modern_pdf_<crate>_bg.wasm for: ${missing.join(', ')}. ` +
      'Run `pnpm run build:wasm` first.',
  );
  process.exit(1);
}

let files = 0;
for (const crate of CRATES) {
  const from = join('src', 'wasm', crate, 'pkg');
  const to = join('dist', 'wasm', crate);
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    // wasm-pack also writes package.json, .gitignore, README, LICENSE: not part of the runtime.
    if (!name.startsWith(`modern_pdf_${crate}`)) continue;
    cpSync(join(from, name), join(to, name));
    files++;
  }
}
console.log(`copy-wasm: copied ${files} files from ${CRATES.length} crates into dist/wasm/.`);
