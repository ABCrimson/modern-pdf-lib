/**
 * Publish gate: inspect the tarball that `pnpm publish` uploads (release.yml publishes the tarball this script checked).
 *
 * 1. Assert the file list holds every `exports` / `bin` / `main` / `module` /
 *    `types` target of package.json, `dist/modern-pdf-lib.iife.js`, and the
 *    wasm-pack output of every Rust crate under `dist/wasm/<crate>/` (the
 *    tarballs of 0.28.1 and later shipped neither the wasm nor the IIFE bundle).
 * 2. Assert every `//# sourceMappingURL=` comment in a packed .mjs/.cjs/.js file points at a
 *    file that is in the tarball (`data:` URLs are exempt), so no consumer gets a dangling map.
 * 3. Run publint and attw against the same tarball.
 *
 * Usage:
 *   pnpm run check:pack              # packs the current directory, then checks it
 *   pnpm run check:pack <file.tgz>   # checks an existing tarball
 *
 * Run it after `pnpm run build` and `pnpm run copy:wasm`. Every failed check is
 * printed; the exit code is 1 if any failed.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, posix, resolve } from 'node:path';

const CRATES = ['libdeflate', 'png', 'ttf', 'shaping', 'jbig2', 'jpeg'];
const WASM_FILES = ['.js', '.d.ts', '_bg.wasm', '_bg.wasm.d.ts'];

/** Thrown after the reason was printed, so `finally` can clean up before exiting 1. */
class Abort extends Error {}

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

/** Quote one argument for the Windows shell that `.cmd` shims (pnpm) need. */
const quote = (arg) => (/[\s"]/.test(arg) ? JSON.stringify(arg) : arg);

/** Run a command to completion; `pnpm` is a `.cmd` shim on Windows, hence the shell there. */
function run(command, args, options = {}) {
  const shell = process.platform === 'win32';
  return spawnSync(shell ? [command, ...args].map(quote).join(' ') : command, shell ? [] : args, {
    encoding: 'utf8',
    shell,
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
}

/** Every string target reachable in an `exports` value; wildcard targets are returned apart. */
function collectTargets(value, out = { files: new Set(), wildcards: new Set() }) {
  if (typeof value === 'string') {
    (value.includes('*') ? out.wildcards : out.files).add(value);
  } else if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) collectTargets(inner, out);
  }
  return out;
}

/** One file's text out of a tarball (cwd + basename: GNU tar reads a `C:` prefix as a remote host). */
function readTarEntry(tarball, entry) {
  const result = run('tar', ['-xzOf', basename(tarball), entry], { cwd: dirname(tarball) });
  if (result.status !== 0)
    throw new Error(`cannot read ${entry} from ${tarball}: ${result.stderr}`);
  return result.stdout;
}

/**
 * Every `//# sourceMappingURL=` target of the given JS files that is not in `files`
 * (`data:` URLs exempt); one message per violation. `read` returns a packed file's text.
 */
function findDanglingSourceMaps(jsFiles, files, read) {
  const violations = [];
  for (const path of jsFiles) {
    for (const match of read(path).matchAll(/^\/\/[#@] sourceMappingURL=(\S+)\s*$/gm)) {
      const url = match[1];
      if (url.startsWith('data:')) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), decodeURI(url)));
      if (!files.has(target))
        violations.push(`${path}: sourceMappingURL ${url} -> ${target} is not in the tarball`);
    }
  }
  return violations;
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tempDir = mkdtempSync(join(tmpdir(), 'check-pack-'));

try {
  // ── Obtain the tarball and its file list ────────────────────────────────
  let tarball;
  let listed;
  const given = process.argv[2];
  if (given) {
    tarball = resolve(given);
    // cwd + basename: GNU tar reads a `C:` prefix as a remote host.
    const listing = run('tar', ['-tzf', basename(tarball)], { cwd: dirname(tarball) });
    if (listing.status !== 0) {
      console.error(`check-pack: cannot list ${tarball}: ${listing.stderr || listing.error}`);
      throw new Abort();
    }
    listed = listing.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((entry) => entry.replace(/^package\//, ''));
  } else {
    const packed = run('pnpm', ['pack', '--pack-destination', tempDir, '--json']);
    if (packed.status !== 0) {
      console.error(`check-pack: pnpm pack failed:\n${packed.stdout}\n${packed.stderr}`);
      throw new Abort();
    }
    const result = JSON.parse(packed.stdout.slice(packed.stdout.indexOf('{')));
    tarball = resolve(result.filename);
    listed = result.files.map((file) => file.path);
  }
  const files = new Set(listed);
  console.log(`check-pack: ${tarball} (${files.size} files)`);

  // ── 1. File-list assertions ─────────────────────────────────────────────
  const expected = new Set(['dist/modern-pdf-lib.iife.js']);
  for (const crate of CRATES) {
    for (const suffix of WASM_FILES)
      expected.add(`dist/wasm/${crate}/modern_pdf_${crate}${suffix}`);
  }
  const { files: exportTargets, wildcards } = collectTargets(pkg.exports);
  for (const target of exportTargets) expected.add(target);
  for (const target of [
    ...Object.values(pkg.bin ?? {}),
    pkg.main,
    pkg.module,
    pkg.types,
    pkg.unpkg,
    pkg.jsdelivr,
  ]) {
    if (target) expected.add(target);
  }
  let missing = 0;
  for (const target of expected) {
    const path = target.replace(/^\.\//, '');
    if (!files.has(path)) {
      missing++;
      fail(`tarball lacks ${path}`);
    }
  }
  if (missing === 0) ok(`all ${expected.size} required files are in the tarball`);
  // Wildcard exports (`./wasm/*`) cannot be enumerated; the explicit wasm list above covers them.
  for (const target of wildcards) {
    const prefix = target.replace(/^\.\//, '').split('*')[0];
    if (![...files].some((path) => path.startsWith(prefix)))
      fail(`tarball has nothing under ${prefix}`);
  }

  // ── 2. Source maps ──────────────────────────────────────────────────────
  // Read the packed files back out of the tarball so the check sees what consumers get.
  const jsFiles = [...files].filter((path) => /\.(?:mjs|cjs|js)$/.test(path));
  const dangling = findDanglingSourceMaps(jsFiles, files, (path) =>
    readTarEntry(tarball, `package/${path}`),
  );
  for (const message of dangling) fail(message);
  if (dangling.length === 0)
    ok(`every sourceMappingURL in ${jsFiles.length} packed JS files resolves inside the tarball`);

  // ── 3. publint ──────────────────────────────────────────────────────────
  const publint = run('pnpm', ['exec', 'publint', 'run', tarball, '--strict']);
  process.stdout.write(publint.stdout ?? '');
  process.stderr.write(publint.stderr ?? '');
  if (publint.status === 0) ok('publint: clean');
  else fail('publint reported problems');

  // ── 4. attw ─────────────────────────────────────────────────────────────
  // Two runs so the intentional exceptions are named:
  //  - `./wasm/*` is a wildcard: attw cannot resolve it and reports `(wildcard)`, not a problem.
  //  - `./browser` is deliberately ESM-only (no `require` condition); checked with the
  //    `esm-only` profile, which skips the node10 and node16-from-CJS resolutions.
  // The `node16` profile ignores node10 resolution for every entrypoint: TypeScript 7 removed
  // `moduleResolution: node10` (error TS5108) and engines.node is >=26.4, so node10 is not a
  // supported consumer. The package ships no `typesVersions`; the subpath entrypoints
  // (./create, ./parse, ./forms) resolve through `exports` under node16 and bundler.
  const attwArgs = ['--no-emoji', '--no-color'];
  const attwMain = run('pnpm', [
    'exec',
    'attw',
    tarball,
    '--profile',
    'node16',
    '--exclude-entrypoints',
    './browser',
    ...attwArgs,
  ]);
  process.stdout.write(attwMain.stdout ?? '');
  process.stderr.write(attwMain.stderr ?? '');
  if (attwMain.status === 0) ok('attw (node16 profile, all entrypoints but ./browser): clean');
  else fail('attw reported problems (node16 profile)');

  const attwBrowser = run('pnpm', [
    'exec',
    'attw',
    tarball,
    '--profile',
    'esm-only',
    '--entrypoints',
    './browser',
    ...attwArgs,
  ]);
  process.stdout.write(attwBrowser.stdout ?? '');
  process.stderr.write(attwBrowser.stderr ?? '');
  if (attwBrowser.status === 0) ok('attw (esm-only profile, ./browser): clean');
  else fail('attw reported problems for ./browser (esm-only profile)');
} catch (error) {
  if (!(error instanceof Abort)) throw error;
  failures.push('aborted before all checks ran');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✗ check-pack FAILED: ${failures.length} problem(s):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log('\n✓ check-pack passed: the tarball is complete and publint/attw are clean.');
