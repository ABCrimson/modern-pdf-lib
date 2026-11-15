/**
 * G-DOC, the path part: the documents stay true to the tree.
 *
 *   node scripts/dev/metrics.ts --check       rule 1, path truth: every repository path that a tracked
 *                                              text file names (a token starting with src/, tests/,
 *                                              scripts/, docs/, audit/, tools/, crates/ or .github/)
 *                                              resolves to a tracked file or a folder of tracked files
 *                                              (a .js specifier to its .ts source, a module name
 *                                              without extension to its .ts file) or to build output
 *                                              (GENERATED). Exempt: history, plans and data
 *                                              (EXEMPT_FILES), the mentions in ALLOWED (synthetic
 *                                              paths in tests, prose), and the lines between a
 *                                              `// metrics: synthetic paths start` and a
 *                                              `// metrics: synthetic paths end` comment line (the
 *                                              made-up trees of self-tests). Rule 1 also reads the
 *                                              comments of the code files under src, tests and
 *                                              scripts for tokens that start with ./ or ../ and
 *                                              resolves each against the folder of its file, by the
 *                                              same rules and with the same exemptions. Rule 2,
 *                                              layout tables: the src
 *                                              folders that the README "Project Structure" tree and the
 *                                              CONTRIBUTING module table list equal the src folders of
 *                                              the tree (depth 1, and depth 2 under a folder whose
 *                                              subfolders the document lists). The SECURITY.md
 *                                              components table and the docs/guide pages fall under
 *                                              rule 1
 *   node scripts/dev/metrics.ts --self-test   runs both rules on synthetic input: each must report the
 *                                              problem planted in it and nothing else
 *   --root <dir>   another checkout to check (default: this repository)
 *
 * Exit 1 on any problem, each printed with the file and line that names the path. The count, size and
 * version rules of G-DOC (the metrics JSON of the roadmap) are not part of this script yet. Node strips
 * the types, so only erasable syntax is used.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    'self-test': { type: 'boolean', default: false },
    root: { type: 'string', default: resolve(import.meta.dirname, '../..') },
  },
});
if (!values.check && !values['self-test']) {
  console.error('usage: node scripts/dev/metrics.ts --check | --self-test [--root <dir>]');
  process.exit(2);
}
const ROOT = resolve(values.root);

/** Files whose paths are history, plans or data, not statements about this tree. */
const EXEMPT_FILES: readonly RegExp[] = [
  /^CHANGELOG\.md$/, // sections of shipped versions keep the paths they were written with
  /^ROADMAP\.md$/, // the plan names files later versions add
  /^tests\/fixtures\//, // fixture data and the manifests generators write
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)Cargo\.lock$/,
  /^tests\/oracle\/packaging\/exports\.api\.json$/, // the API snapshot
];
/** Text files the rule reads. */
const TEXT = /\.(ts|mts|cts|mjs|cjs|js|json|md|yml|yaml|toml|sh|vue|rs)$/;
/** Build output and installed packages: named by documents, never tracked. */
const GENERATED: readonly RegExp[] = [
  /^docs\/api(\/|$)/, // TypeDoc output (docs:api)
  /^crates\/[a-z0-9_-]+\/(pkg|target)(\/|$)/, // wasm-pack and cargo output
  /(^|\/)node_modules(\/|$)/,
  /^docs\/\.vitepress\/(dist|cache)(\/|$)/,
];
/**
 * Mentions that are not paths of this tree, as `<file>: <token>` with the reason. Each entry must still
 * occur (a stale entry is a problem), so the list shrinks with the text it excuses.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  // metrics: synthetic paths start
  'tests/unit/helpers/known-defects-census.test.ts: tests/unit/sample.test.ts':
    'synthetic file name of a census fixture',
  'tests/unit/helpers/known-defects-census.test.ts: tests/unit/alias.test.ts':
    'synthetic file name of a census fixture',
  'tests/unit/helpers/known-defects-census.test.ts: tests/unit/none.test.ts':
    'synthetic file name of a census fixture',
  'src/index.ts: audit/hardening': 'prose: "the audit/hardening layer", not a path',
  'scripts/build/check-pack.mjs: ./browser': 'a subpath of the package exports map, not a file',
  'scripts/build/check-pack.mjs: ./create': 'a subpath of the package exports map, not a file',
  'scripts/build/check-pack.mjs: ./parse': 'a subpath of the package exports map, not a file',
  'scripts/build/check-pack.mjs: ./forms': 'a subpath of the package exports map, not a file',
  'scripts/dev/api-snapshot.ts: ./create': 'a subpath of the package exports map, not a file',
  'scripts/dev/api-snapshot.ts: ./parse': 'a subpath of the package exports map, not a file',
  'scripts/dev/api-snapshot.ts: ./forms': 'a subpath of the package exports map, not a file',
  'scripts/dev/api-snapshot.ts: ./browser': 'a subpath of the package exports map, not a file',
  'scripts/dev/api-snapshot.ts: ./x.mjs':
    'illustrative specifier in the doc comment of resolveSpecifier',
  'scripts/dev/api-snapshot.ts: ./x.d.mts':
    'illustrative declaration file in the doc comment of resolveSpecifier',
  'scripts/dev/size-gate.ts: ./dist/index.mjs':
    'the bundle entry the gate writes, relative to the package root, not to this file',
  'src/wasm/loader.ts: ./deflate.wasm':
    'illustrative import of a Worker project in a usage example',
  // metrics: synthetic paths end
};
/** A comment line that opens or closes a block of made-up paths (the tree of a self-test). */
const SYNTHETIC = /^\s*\/\/ metrics: synthetic paths (start|end)$/;

/** Code files whose comments rule 1 also reads for paths relative to the file's folder. */
const CODE = /^(src|tests|scripts)\/.*\.(ts|mts|cts|mjs|cjs|js)$/;
/** A path relative to the folder of the file that names it. */
const RELATIVE = /(?<![\w./@-])\.\.?\/[A-Za-z0-9_./-]*[A-Za-z0-9_]/g;

const TOKEN =
  /(?<![\w./@-])(?:src|tests|scripts|docs|audit|tools|crates|\.github)\/[A-Za-z0-9_./-]*[A-Za-z0-9_]/g;

export interface PathProblem {
  readonly file: string;
  readonly line: number;
  readonly token: string;
}

/** Rule 1 over a set of files: every token that names no path of `tracked` (files and their folders). */
export function pathProblems(
  texts: ReadonlyMap<string, string>,
  tracked: readonly string[],
): { problems: PathProblem[]; mentions: number; relative: number } {
  const known = new Set<string>();
  for (const f of tracked) {
    const parts = f.split('/');
    for (let i = 1; i <= parts.length; i++) known.add(parts.slice(0, i).join('/'));
  }
  const resolves = (p: string): boolean =>
    known.has(p) ||
    known.has(p.replace(/\.js$/, '.ts')) ||
    known.has(p.replace(/\.mjs$/, '.mts')) ||
    known.has(`${p}.ts`) ||
    known.has(`${p}.test.ts`) || // a test module named by its @module tag
    GENERATED.some((g) => g.test(p));
  const problems: PathProblem[] = [];
  let mentions = 0;
  let relative = 0;
  for (const [file, text] of texts) {
    if (EXEMPT_FILES.some((e) => e.test(file)) || !TEXT.test(file)) continue;
    const lines = text.split('\n');
    const comments = CODE.test(file) ? commentText(lines) : [];
    const folder = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    let synthetic = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const marker = SYNTHETIC.exec(line);
      if (marker !== null) synthetic = marker[1] === 'start';
      if (synthetic) continue;
      for (const m of line.matchAll(TOKEN)) {
        const end = m.index + m[0].length;
        // globs and templates in the next two characters (crates/*/pkg, tests/unit/<path>/<module>.test.ts, ${dir}) are patterns
        if (/[*<>{}$]/.test(line.slice(end, end + 2))) continue;
        const token = m[0].replace(/[./]+$/, '');
        mentions++;
        if (!resolves(token)) problems.push({ file, line: i + 1, token });
      }
      for (const m of (comments[i] ?? '').matchAll(RELATIVE)) {
        const rest = comments[i] ?? '';
        const end = m.index + m[0].length;
        if (/[*<>{}$]/.test(rest.slice(end, end + 2))) continue;
        const token = m[0].replace(/[./]+$/, '');
        relative++;
        const target = posix.normalize(posix.join(folder, token)).replace(/\/$/, '');
        if (target.startsWith('..') || !resolves(target === '.' ? '' : target))
          problems.push({ file, line: i + 1, token });
      }
    }
  }
  return { problems, mentions, relative };
}

/**
 * The comment text of each line of a code file: a line inside a block comment, the rest of a line from
 * a `//` or a `/*` that starts it or follows a space, else nothing. Line-based on purpose: a comment
 * opener inside a string on the same line is rare, and a false hit shows as a problem to look at.
 */
export function commentText(lines: readonly string[]): string[] {
  const out: string[] = [];
  let block = false;
  for (const line of lines) {
    let text = line;
    let comment = '';
    if (block) {
      const close = text.indexOf('*/');
      if (close < 0) {
        out.push(text);
        continue;
      }
      comment = text.slice(0, close);
      text = text.slice(close + 2);
      block = false;
    }
    const lineAt = text.search(/(^|\s)\/\//);
    const blockAt = text.search(/(^|\s)\/\*/);
    if (blockAt >= 0 && (lineAt < 0 || blockAt < lineAt)) {
      const close = text.indexOf('*/', blockAt + 3);
      comment += ` ${close < 0 ? text.slice(blockAt) : text.slice(blockAt, close)}`;
      block = close < 0;
    } else if (lineAt >= 0) comment += ` ${text.slice(lineAt)}`;
    out.push(comment);
  }
  return out;
}

/** The src folders a README "Project Structure" tree lists (`  src/` then `    <name>/` lines). */
export function readmeFolders(text: string): string[] {
  const start = text.indexOf('## Project Structure');
  if (start < 0) return [];
  const lines = text.slice(start).split('\n');
  const out: string[] = [];
  let inSrc = false;
  for (const line of lines) {
    if (line.startsWith('```') && inSrc) break;
    if (/^ {2}src\/\s*/.test(line)) {
      inSrc = true;
      continue;
    }
    if (!inSrc) continue;
    const m = /^ {4}([A-Za-z0-9_-]+)\//.exec(line);
    if (m !== null) out.push(`src/${m[1]}`);
    else if (/^ {2}\S/.test(line)) break;
  }
  return out;
}

/** The src folders a CONTRIBUTING table lists as the first cell of a row (`| \`src/<folder>/\` |`). */
export function tableFolders(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^\| `(src\/[A-Za-z0-9_/-]+?)\/?` \|/gm))
    if (m[1] !== undefined) out.push(m[1]);
  return out;
}

/** Rule 2: the listed folders against the folders of the tree. */
export function layoutTableProblems(
  doc: string,
  listed: readonly string[],
  tracked: readonly string[],
): string[] {
  const dirs = new Set<string>();
  for (const f of tracked) {
    const parts = f.split('/');
    if (parts[0] !== 'src') continue;
    for (let i = 2; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const listedSet = new Set(listed);
  const problems: string[] = [];
  const depth = (d: string): number => d.split('/').length - 1;
  for (const d of listed)
    if (!dirs.has(d)) problems.push(`${doc}: lists ${d}/, which is not a folder of src`);
  for (const d of [...dirs].toSorted())
    if (depth(d) === 1 && !listedSet.has(d)) problems.push(`${doc}: does not list ${d}/`);
  // a document that lists a subfolder of a folder lists all of them
  const expanded = new Set(
    listed.filter((d) => depth(d) === 2).map((d) => d.split('/').slice(0, 2).join('/')),
  );
  for (const d of [...dirs].toSorted())
    if (depth(d) === 2 && expanded.has(d.split('/').slice(0, 2).join('/')) && !listedSet.has(d))
      problems.push(
        `${doc}: lists subfolders of ${d.split('/').slice(0, 2).join('/')}/ but not ${d}/`,
      );
  return problems;
}

function selfTest(): string[] {
  const out: string[] = [];
  // metrics: synthetic paths start
  const tracked = [
    'src/index.ts',
    'src/core/pdfDocument.ts',
    'src/core/io/writer.ts',
    'src/core/internal/x.ts',
    'docs/guide/a.md',
  ];
  const texts = new Map([
    [
      'scripts/made-up.ts',
      '// metrics: synthetic paths start\nsrc/made/up.ts\n// metrics: synthetic paths end\n',
    ],
    [
      'docs/guide/a.md',
      'See src/core/pdfDocument.ts and src/core/pdfDocument.js, src/core/io/, src/core/gone.ts.\n',
    ],
    ['CHANGELOG.md', 'src/old/path.ts\n'],
    [
      'src/core/io/writer.ts',
      "// uses ../pdfDocument.ts and ./gone.ts\nimport { x } from './nowhere.js';\n/**\n * {@link import('../internal/x.js').X}\n */\n",
    ],
    [
      'src/index.ts',
      '// crates/*/pkg and src/core/<module>.ts are patterns; docs/api/index.md is output\n',
    ],
  ]);
  const r = pathProblems(texts, tracked);
  const got = r.problems.map((p) => `${p.file}:${p.line} ${p.token}`).join('; ');
  if (got !== 'docs/guide/a.md:1 src/core/gone.ts; src/core/io/writer.ts:1 ./gone.ts')
    out.push(`self-test: rule 1 reported "${got}"`);
  if (r.mentions !== 5) out.push(`self-test: rule 1 counted ${r.mentions} mentions, expected 5`);
  if (r.relative !== 3)
    out.push(`self-test: rule 1 counted ${r.relative} relative mentions in comments, expected 3`);
  const readme =
    '## Project Structure\n\n```\nx/\n  src/\n    core/   model\n    gone/   old\n  tests/  t\n```\n';
  const listed = readmeFolders(readme);
  if (listed.join() !== 'src/core,src/gone')
    out.push(`self-test: README tree read as ${listed.join()}`);
  const t = layoutTableProblems('README.md', listed, tracked);
  if (t.join('; ') !== 'README.md: lists src/gone/, which is not a folder of src')
    out.push(`self-test: rule 2 reported "${t.join('; ')}"`);
  const table =
    '| Directory | Contents |\n|---|---|\n| `src/core/` | a |\n| `src/core/io/` | b |\n';
  const t2 = layoutTableProblems('CONTRIBUTING.md', tableFolders(table), tracked);
  if (t2.join('; ') !== 'CONTRIBUTING.md: lists subfolders of src/core/ but not src/core/internal/')
    out.push(`self-test: rule 2 on a table reported "${t2.join('; ')}"`);
  // metrics: synthetic paths end
  console.log(
    `self-test: rule 1 found the planted path among ${r.mentions} mentions and the planted relative path among ${r.relative} in comments; rule 2 found both planted folders`,
  );
  return out;
}

const problems: string[] = [];
if (values['self-test']) problems.push(...selfTest());
if (values.check) {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\0')
    .filter((f) => f !== '');
  const texts = new Map<string, string>();
  for (const f of tracked) if (TEXT.test(f)) texts.set(f, readFileSync(resolve(ROOT, f), 'utf8'));
  const r = pathProblems(texts, tracked);
  const used = new Set<string>();
  let allowedHits = 0;
  for (const p of r.problems) {
    const key = `${p.file}: ${p.token}`;
    if (key in ALLOWED) {
      used.add(key);
      allowedHits++;
    } else problems.push(`${p.file}:${p.line}: ${p.token} names no path of the tree`);
  }
  for (const key of Object.keys(ALLOWED))
    if (!used.has(key)) problems.push(`ALLOWED entry no longer needed: ${key}`);
  console.log(
    `paths: ${r.mentions} mentions and ${r.relative} relative mentions in comments, ${r.problems.length - allowedHits} unresolved, ${allowedHits} allowed by ${used.size} ALLOWED entries`,
  );
  const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  const contributing = readFileSync(resolve(ROOT, 'CONTRIBUTING.md'), 'utf8');
  const fromReadme = readmeFolders(readme);
  const fromTable = tableFolders(contributing);
  problems.push(...layoutTableProblems('README.md', fromReadme, tracked));
  problems.push(...layoutTableProblems('CONTRIBUTING.md', fromTable, tracked));
  console.log(
    `layout tables: README lists ${fromReadme.length} src folders, CONTRIBUTING ${fromTable.length}`,
  );
}
for (const p of problems) console.error(p);
console.log(problems.length === 0 ? 'metrics: ok' : `metrics: ${problems.length} problems`);
process.exit(problems.length === 0 ? 0 : 1);
