/**
 * G-API: the export snapshot of the BUILT package (dist/), and its diff against a release.
 *
 *   node scripts/dev/api-snapshot.ts --json          print the snapshot (the text of
 *                                                    tests/oracle/packaging/exports.api.json)
 *   node scripts/dev/api-snapshot.ts --stats         one line per entry: runtime and type-only counts
 *   node scripts/dev/api-snapshot.ts --diff [<ref>]  the diff of the snapshot file at <ref> (default:
 *                                                    the previous release, tagged or not, see
 *                                                    previousReleaseRef()) against the snapshot file
 *                                                    in the working tree; the text the CHANGELOG
 *                                                    block between <!-- api-diff:begin --> and
 *                                                    <!-- api-diff:end --> carries
 *
 * For each module entry of package.json `exports` (`.`, `./create`, `./parse`, `./forms`,
 * `./browser`) the snapshot records every exported name with its kind and a declaration hash:
 *
 * - Runtime names come from importing the entry's `import` file; the `require` file, where the
 *   entry has one, is loaded through createRequire and must yield the same name set.
 * - Type-only names are the names the entry's `.d.mts` exports that the import does not yield.
 * - `kind`: `function` or `class` for a callable runtime value (class when
 *   Function.prototype.toString starts with `class`); `enum`, `namespace` or `const` for any other
 *   runtime value (enum or namespace when its declaration is one); for a type-only name, the kind
 *   of its declaration node (`interface`, `type`, `enum`, `namespace`, `class`, `function`,
 *   `const`).
 * - `decl`: `sha256:` and the first 12 hex digits of SHA-256 over the source text of every
 *   top-level declaration of the exported binding in the `.d.mts` files (overloads and merged
 *   declarations in source order), parsed with oxc-parser, with comments removed, the `$<n>`
 *   suffixes rolldown adds to deduplicate local names removed, and whitespace runs collapsed to one
 *   space. A JSDoc edit does not move it; a signature change does. Only the exported binding's own
 *   declaration is hashed: a change in an unexported type it refers to is not seen.
 *
 * `./wasm/*` is a file pattern, not a module: it is recorded as the sorted list of files under
 * dist/wasm/ (written by `pnpm run copy:wasm` after the build, as the CI build job does).
 *
 * The snapshot is only as current as dist/. Modification times on this tree do not say whether
 * dist/ was built from the current src/, so the script only warns (stderr) with the number of
 * src/ files newer than dist/index.mjs. Node strips the types, so only erasable syntax is used.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseSync } from 'oxc-parser';
import type { Comment, ModuleExportName, Node, Program } from 'oxc-parser';

/** Repo root (this file is scripts/dev/api-snapshot.ts). */
export const ROOT = resolve(import.meta.dirname, '../..');
/** The committed snapshot, relative to the repo root (forward slashes, as git show wants it). */
export const SNAPSHOT_PATH = 'tests/oracle/packaging/exports.api.json';
/** The single line of an empty diff. */
export const NO_CHANGE = 'No export added, removed or changed.';

export type Kind = 'function' | 'class' | 'const' | 'enum' | 'namespace' | 'interface' | 'type';

export interface ApiName {
  readonly kind: Kind;
  readonly decl: string;
}

export interface ModuleEntry {
  readonly runtime: number;
  readonly typeOnly: number;
  readonly names: Readonly<Record<string, ApiName>>;
}

export interface FilesEntry {
  readonly files: readonly string[];
}

export interface ApiSnapshot {
  readonly format: 1;
  readonly package: string;
  readonly entries: Readonly<Record<string, ModuleEntry | FilesEntry>>;
}

/** Code-point order (the names are ASCII identifiers, so code units order them the same). */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const exportName = (n: ModuleExportName): string => (n.type === 'Literal' ? n.value : n.name);

// ---------------------------------------------------------------------------
// Declaration files
// ---------------------------------------------------------------------------

type Binding =
  | { readonly from: 'local'; readonly local: string }
  | { readonly from: 'module'; readonly source: string; readonly imported: string };

interface DeclFile {
  readonly text: string;
  readonly comments: readonly Comment[];
  /** Top-level declaration nodes by declared name, in source order. */
  readonly locals: Map<string, Node[]>;
  /** Imported local name -> source specifier and imported name (`*` for a namespace import). */
  readonly imports: Map<string, { readonly source: string; readonly imported: string }>;
  /** Exported name -> binding. */
  readonly exports: Map<string, Binding>;
  /** `export * from` sources. */
  readonly stars: string[];
}

const declFiles = new Map<string, DeclFile>();

/** The names a top-level declaration node declares. */
function declaredNames(node: Node): string[] {
  switch (node.type) {
    case 'TSDeclareFunction':
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return node.id === null ? [] : [node.id.name];
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
    case 'TSEnumDeclaration':
      return [node.id.name];
    case 'TSModuleDeclaration':
      return node.id.type === 'Identifier' ? [node.id.name] : [];
    case 'VariableDeclaration':
      return node.declarations.flatMap((d) => (d.id.type === 'Identifier' ? [d.id.name] : []));
    default:
      return [];
  }
}

function readDeclFile(file: string): DeclFile {
  const cached = declFiles.get(file);
  if (cached !== undefined) return cached;
  const text = readFileSync(file, 'utf8');
  const result = parseSync(file, text, { lang: 'dts', sourceType: 'module' });
  if (result.errors.length > 0) {
    throw new Error(`${file}: oxc-parser: ${result.errors.map((e) => e.message).join('; ')}`);
  }
  const program: Program = result.program;
  const df: DeclFile = {
    text,
    comments: result.comments,
    locals: new Map(),
    imports: new Map(),
    exports: new Map(),
    stars: [],
  };
  const addLocal = (node: Node): void => {
    for (const name of declaredNames(node)) {
      const list = df.locals.get(name) ?? [];
      list.push(node);
      df.locals.set(name, list);
    }
  };
  for (const stmt of program.body) {
    switch (stmt.type) {
      case 'ImportDeclaration':
        for (const spec of stmt.specifiers) {
          const imported =
            spec.type === 'ImportSpecifier'
              ? exportName(spec.imported)
              : spec.type === 'ImportDefaultSpecifier'
                ? 'default'
                : '*';
          df.imports.set(spec.local.name, { source: stmt.source.value, imported });
        }
        break;
      case 'ExportNamedDeclaration':
        if (stmt.declaration !== null) {
          addLocal(stmt.declaration);
          for (const name of declaredNames(stmt.declaration)) {
            df.exports.set(name, { from: 'local', local: name });
          }
        }
        for (const spec of stmt.specifiers) {
          const name = exportName(spec.exported);
          const local = exportName(spec.local);
          df.exports.set(
            name,
            stmt.source === null
              ? { from: 'local', local }
              : { from: 'module', source: stmt.source.value, imported: local },
          );
        }
        break;
      case 'ExportAllDeclaration':
        if (stmt.exported === null) df.stars.push(stmt.source.value);
        else
          df.exports.set(exportName(stmt.exported), {
            from: 'module',
            source: stmt.source.value,
            imported: '*',
          });
        break;
      default:
        addLocal(stmt);
    }
  }
  declFiles.set(file, df);
  return df;
}

/** The declaration file a relative specifier of `from` names (`./x.mjs` -> `./x.d.mts`). */
function resolveSpecifier(from: string, specifier: string): string {
  if (!specifier.startsWith('.')) {
    throw new Error(`${from}: export from the external module ${specifier} is not supported`);
  }
  const target = resolve(dirname(from), specifier);
  for (const candidate of [
    target.replace(/\.mjs$/, '.d.mts'),
    target.replace(/\.js$/, '.d.ts'),
    `${target}.d.mts`,
    target,
  ]) {
    if (candidate.endsWith('.d.mts') || candidate.endsWith('.d.ts')) {
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`${from}: cannot resolve ${specifier} to a declaration file`);
}

interface Resolved {
  readonly file: string;
  readonly nodes: readonly Node[];
}

function resolveLocal(file: string, local: string, seen: Set<string>): Resolved | undefined {
  const df = readDeclFile(file);
  const nodes = df.locals.get(local);
  if (nodes !== undefined) return { file, nodes };
  const imp = df.imports.get(local);
  if (imp === undefined) return undefined;
  return resolveExport(resolveSpecifier(file, imp.source), imp.imported, seen);
}

function resolveExport(file: string, name: string, seen: Set<string>): Resolved | undefined {
  const key = `${file}\0${name}`;
  if (seen.has(key)) return undefined;
  seen.add(key);
  const df = readDeclFile(file);
  const binding = df.exports.get(name);
  if (binding !== undefined) {
    return binding.from === 'local'
      ? resolveLocal(file, binding.local, seen)
      : resolveExport(resolveSpecifier(file, binding.source), binding.imported, seen);
  }
  if (name === 'default') return undefined;
  for (const star of df.stars) {
    const found = resolveExport(resolveSpecifier(file, star), name, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Every name a declaration file exports, following `export *`. */
function exportedNames(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file)) return names;
  seen.add(file);
  const df = readDeclFile(file);
  for (const name of df.exports.keys()) names.add(name);
  for (const star of df.stars) {
    for (const name of exportedNames(resolveSpecifier(file, star), seen)) {
      if (name !== 'default') names.add(name);
    }
  }
  return names;
}

/** Declaration text with comments and rolldown's `$<n>` suffixes removed, whitespace collapsed. */
function normalizedText(resolved: Resolved): string {
  const df = readDeclFile(resolved.file);
  return resolved.nodes
    .map((node) => {
      let out = '';
      let at = node.start;
      for (const c of df.comments) {
        if (c.start < node.start || c.end > node.end) continue;
        out += `${df.text.slice(at, c.start)} `;
        at = c.end;
      }
      out += df.text.slice(at, node.end);
      return out;
    })
    .join('\n')
    .replace(/(?<=[\w$])\$\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function declHash(resolved: Resolved): string {
  const hex = createHash('sha256').update(normalizedText(resolved)).digest('hex');
  return `sha256:${hex.slice(0, 12)}`;
}

/** The kind the declaration nodes give: the first node that decides it. */
function declKind(nodes: readonly Node[]): Kind {
  const types = nodes.map((n) => n.type);
  if (types.includes('ClassDeclaration')) return 'class';
  if (types.includes('TSEnumDeclaration')) return 'enum';
  if (types.includes('TSDeclareFunction') || types.includes('FunctionDeclaration'))
    return 'function';
  if (types.includes('VariableDeclaration')) return 'const';
  if (types.includes('TSInterfaceDeclaration')) return 'interface';
  if (types.includes('TSTypeAliasDeclaration')) return 'type';
  if (types.includes('TSModuleDeclaration')) return 'namespace';
  throw new Error(`no kind for declaration nodes ${types.join(', ')}`);
}

function runtimeKind(value: unknown, nodes: readonly Node[]): Kind {
  if (typeof value === 'function') {
    return Function.prototype.toString.call(value).startsWith('class') ? 'class' : 'function';
  }
  const types = nodes.map((n) => n.type);
  if (types.includes('TSEnumDeclaration')) return 'enum';
  if (types.includes('TSModuleDeclaration') && !types.includes('VariableDeclaration'))
    return 'namespace';
  return 'const';
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

interface PackageJson {
  readonly name: string;
  readonly version: string;
  readonly exports: Readonly<Record<string, unknown>>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function conditionFile(value: unknown, condition: 'import' | 'require', key: string): unknown {
  if (!isRecord(value)) return undefined;
  const target = value[condition];
  return isRecord(target) ? target[key] : undefined;
}

export function readPackageJson(root = ROOT): PackageJson {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as PackageJson;
}

/** Number of src/ files modified after dist/index.mjs (a hint only: see the header). */
export function srcNewerThanDist(root = ROOT): number {
  const dist = join(root, 'dist/index.mjs');
  if (!existsSync(dist)) return 0;
  const built = statSync(dist).mtimeMs;
  return globSync('src/**/*.ts', { cwd: root }).filter(
    (f) => statSync(join(root, f)).mtimeMs > built,
  ).length;
}

/** Builds the snapshot from root/dist. Throws, naming each problem, when dist/ is inconsistent. */
export async function buildSnapshot(root = ROOT): Promise<ApiSnapshot> {
  const pkg = readPackageJson(root);
  const requireFromRoot = createRequire(join(root, 'package.json'));
  const problems: string[] = [];
  const entries: Record<string, ModuleEntry | FilesEntry> = {};

  for (const [entry, value] of Object.entries(pkg.exports)) {
    if (typeof value === 'string') {
      if (!value.endsWith('/*')) {
        problems.push(`${entry}: a string target other than a directory pattern`);
        continue;
      }
      const dir = join(root, value.slice(0, -2));
      const files = existsSync(dir)
        ? globSync('**/*', { cwd: dir, withFileTypes: true })
            .filter((d) => d.isFile())
            .map((d) =>
              join(d.parentPath, d.name)
                .slice(dir.length + 1)
                .replaceAll('\\', '/'),
            )
            .sort(byCodePoint)
        : [];
      if (files.length === 0) problems.push(`${entry}: no file under ${value.slice(0, -2)}`);
      entries[entry] = { files };
      continue;
    }
    const esm = conditionFile(value, 'import', 'default');
    const types = conditionFile(value, 'import', 'types');
    if (typeof esm !== 'string' || typeof types !== 'string') {
      problems.push(`${entry}: no import.default and import.types`);
      continue;
    }
    const ns = (await import(pathToFileURL(join(root, esm)).href)) as Record<string, unknown>;
    const runtimeNames = Object.keys(ns);
    const cjs = conditionFile(value, 'require', 'default');
    if (typeof cjs === 'string') {
      const required = requireFromRoot(join(root, cjs)) as Record<string, unknown>;
      const cjsNames = new Set(Object.keys(required).filter((n) => n !== '__esModule'));
      const esmNames = new Set(runtimeNames);
      for (const n of esmNames.difference(cjsNames))
        problems.push(`${entry}: ${n} missing from ${cjs}`);
      for (const n of cjsNames.difference(esmNames)) problems.push(`${entry}: ${n} only in ${cjs}`);
    }
    const dts = join(root, types);
    const declared = exportedNames(dts);
    const names: Record<string, ApiName> = {};
    let typeOnly = 0;
    for (const name of [...new Set([...runtimeNames, ...declared])].sort(byCodePoint)) {
      const resolved = declared.has(name) ? resolveExport(dts, name, new Set()) : undefined;
      if (resolved === undefined) {
        problems.push(`${entry}: ${name} has no declaration in ${types}`);
        continue;
      }
      const isRuntime = Object.hasOwn(ns, name);
      if (!isRuntime) typeOnly++;
      names[name] = {
        kind: isRuntime ? runtimeKind(ns[name], resolved.nodes) : declKind(resolved.nodes),
        decl: declHash(resolved),
      };
    }
    entries[entry] = { runtime: runtimeNames.length, typeOnly, names };
  }
  if (problems.length > 0) throw new Error(`api-snapshot:\n  ${problems.join('\n  ')}`);
  return { format: 1, package: pkg.name, entries };
}

/** The snapshot as the committed file stores it. */
export function serializeSnapshot(snapshot: ApiSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

const isFilesEntry = (e: ModuleEntry | FilesEntry | undefined): e is FilesEntry =>
  e !== undefined && 'files' in e;

/**
 * The diff of two snapshots, one line per change: first additions and removals
 * (`+ <entry> <name> (<kind>)`, `- <entry> <name> (<kind>)`; a kind change is a removal and an
 * addition), sorted by entry, name and sign; then declaration changes on separate lines
 * (`~ <entry> <name> (<kind>, declaration changed)`). Files of a pattern entry show as
 * `+ ./wasm/* <file> (file)`. An empty array means no change.
 */
export function diffSnapshots(before: ApiSnapshot, after: ApiSnapshot): string[] {
  const names: string[] = [];
  const decls: string[] = [];
  const entryKeys = [...new Set([...Object.keys(before.entries), ...Object.keys(after.entries)])];
  for (const entry of entryKeys.sort(byCodePoint)) {
    const a = before.entries[entry];
    const b = after.entries[entry];
    if (isFilesEntry(a) || isFilesEntry(b)) {
      const fa = new Set(isFilesEntry(a) ? a.files : []);
      const fb = new Set(isFilesEntry(b) ? b.files : []);
      for (const f of [...fa.union(fb)].sort(byCodePoint)) {
        if (!fb.has(f)) names.push(`- ${entry} ${f} (file)`);
        if (!fa.has(f)) names.push(`+ ${entry} ${f} (file)`);
      }
      continue;
    }
    const na = a?.names ?? {};
    const nb = b?.names ?? {};
    const all = [...new Set([...Object.keys(na), ...Object.keys(nb)])].sort(byCodePoint);
    for (const name of all) {
      const x = na[name];
      const y = nb[name];
      if (x !== undefined && (y === undefined || y.kind !== x.kind)) {
        names.push(`- ${entry} ${name} (${x.kind})`);
      }
      if (y !== undefined && (x === undefined || y.kind !== x.kind)) {
        names.push(`+ ${entry} ${name} (${y.kind})`);
      }
      if (x !== undefined && y !== undefined && x.kind === y.kind && x.decl !== y.decl) {
        decls.push(`~ ${entry} ${name} (${y.kind}, declaration changed)`);
      }
    }
  }
  return [...names, ...decls];
}

/** The diff as the CHANGELOG block carries it. */
export function formatDiff(lines: readonly string[]): string {
  return lines.length === 0 ? NO_CHANGE : lines.join('\n');
}

const git = (root: string, args: readonly string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const parseVersion = (v: string): readonly number[] | undefined => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m === null ? undefined : [Number(m[1]), Number(m[2]), Number(m[3])];
};

const versionLess = (a: readonly number[], b: readonly number[]): boolean => {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
};

/** The `vX.Y.Z` tags merged into HEAD, by tag name. */
const mergedReleaseTags = (root: string): Map<string, readonly number[]> => {
  const tags = new Map<string, readonly number[]>();
  for (const line of git(root, ['tag', '--merged', 'HEAD', '--list', 'v*']).split('\n')) {
    const tag = line.trim();
    const v = parseVersion(tag);
    if (v !== undefined) tags.set(tag, v);
  }
  return tags;
};

/**
 * The newest `vX.Y.Z` tag merged into HEAD whose version is below package.json's version (so a
 * tag on HEAD for the version being released is not its own baseline). Undefined when there is
 * none. Releases not yet tagged are invisible here: previousReleaseRef() sees them.
 */
function previousReleaseTag(root = ROOT): string | undefined {
  const current = parseVersion(readPackageJson(root).version);
  if (current === undefined) return undefined;
  let best: { tag: string; v: readonly number[] } | undefined;
  for (const [tag, v] of mergedReleaseTags(root)) {
    if (!versionLess(v, current)) continue;
    if (best === undefined || versionLess(best.v, v)) best = { tag, v };
  }
  return best?.tag;
}

/**
 * The git ref of the release before package.json's version, tagged or not. The previous release
 * is the highest version below the current one among the `vX.Y.Z` tags merged into HEAD and the
 * `## [X.Y.Z]` headings of CHANGELOG.md. Its ref is its tag `vX.Y.Z` when that tag is merged into
 * HEAD, else the oldest commit reachable from HEAD in which package.json's `"version"` is that
 * version (releases stack up untagged until their tag is cut, and a CI checkout may lack the
 * tag); when no such commit exists, the newest merged tag below the current version. Undefined
 * when there is no previous release.
 */
export function previousReleaseRef(root = ROOT): string | undefined {
  const current = parseVersion(readPackageJson(root).version);
  if (current === undefined) return undefined;
  const tags = mergedReleaseTags(root);
  const candidates = new Map<string, readonly number[]>();
  const consider = (v: readonly number[] | undefined): void => {
    if (v !== undefined && versionLess(v, current)) candidates.set(v.join('.'), v);
  };
  for (const v of tags.values()) consider(v);
  const changelog = join(root, 'CHANGELOG.md');
  if (existsSync(changelog)) {
    for (const m of readFileSync(changelog, 'utf8').matchAll(/^## \[([^\]]+)\]/gm)) {
      consider(parseVersion(m[1] ?? ''));
    }
  }
  let best: { version: string; v: readonly number[] } | undefined;
  for (const [version, v] of candidates) {
    if (best === undefined || versionLess(best.v, v)) best = { version, v };
  }
  if (best === undefined) return undefined;
  const tag = `v${best.version}`;
  if (tags.has(tag)) return tag;
  const hashes = git(root, [
    'log',
    '--format=%H',
    '-S',
    `"version": "${best.version}"`,
    '--',
    'package.json',
  ])
    .split('\n')
    .map((h) => h.trim())
    .filter((h) => h !== '')
    .reverse();
  for (const hash of hashes) {
    try {
      const pkg = JSON.parse(git(root, ['show', `${hash}:package.json`])) as { version?: unknown };
      if (pkg.version === best.version) return hash;
    } catch {
      // A commit whose package.json is absent or unparseable is not a release commit.
    }
  }
  return previousReleaseTag(root);
}

/** The snapshot file at a git ref, or undefined when the ref has none. */
export function snapshotAtRef(ref: string, root = ROOT): ApiSnapshot | undefined {
  try {
    return JSON.parse(git(root, ['show', `${ref}:${SNAPSHOT_PATH}`])) as ApiSnapshot;
  } catch {
    return undefined;
  }
}

/**
 * The api-diff block of the topmost release section of CHANGELOG.md text: the lines between
 * `<!-- api-diff:begin -->` and `<!-- api-diff:end -->` under the first `## [` heading, before
 * the next `## ` heading, with one surrounding ``` fence, blank edge lines and trailing spaces
 * removed. Undefined when that section has no block.
 */
export function changelogApiBlock(changelog: string): string | undefined {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('## ['));
  if (start === -1) return undefined;
  const next = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  const section = lines.slice(start + 1, next === -1 ? undefined : next);
  const begin = section.findIndex((l) => l.trim() === '<!-- api-diff:begin -->');
  const end = section.findIndex((l, i) => i > begin && l.trim() === '<!-- api-diff:end -->');
  if (begin === -1 || end === -1) return undefined;
  let body = section.slice(begin + 1, end).map((l) => l.trimEnd());
  while (body[0] === '') body = body.slice(1);
  while (body.at(-1) === '') body = body.slice(0, -1);
  if (body[0]?.startsWith('```') === true && body.at(-1) === '```') body = body.slice(1, -1);
  return body.join('\n');
}

/** The snapshot file in the working tree. */
export function workingSnapshot(root = ROOT): ApiSnapshot {
  return JSON.parse(readFileSync(join(root, SNAPSHOT_PATH), 'utf8')) as ApiSnapshot;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      stats: { type: 'boolean', default: false },
      diff: { type: 'boolean', default: false },
    },
  });
  if (values.diff) {
    const ref = positionals[0] ?? previousReleaseRef();
    const before = ref === undefined ? undefined : snapshotAtRef(ref);
    const after = workingSnapshot();
    console.error(`api-snapshot: baseline ${ref ?? 'none (no previous release)'}`);
    if (before === undefined) {
      console.error(
        `api-snapshot: ${ref ?? 'no previous release'} has no ${SNAPSHOT_PATH}; the baseline is the working-tree file`,
      );
    }
    console.log(formatDiff(diffSnapshots(before ?? after, after)));
    return 0;
  }
  if (!values.json && !values.stats) {
    console.error('usage: node scripts/dev/api-snapshot.ts --json | --stats | --diff [<ref>]');
    return 2;
  }
  const newer = srcNewerThanDist();
  if (newer > 0) {
    console.error(
      `api-snapshot: warning: ${newer} src/ file(s) are newer than dist/index.mjs; rebuild if the export surface changed`,
    );
  }
  const snapshot = await buildSnapshot();
  if (values.json) process.stdout.write(serializeSnapshot(snapshot));
  if (values.stats) {
    for (const [entry, e] of Object.entries(snapshot.entries)) {
      console.log(
        isFilesEntry(e)
          ? `${entry} files ${e.files.length}`
          : `${entry} runtime ${e.runtime} typeOnly ${e.typeOnly}`,
      );
    }
  }
  return 0;
}

// Not process.exit(): on POSIX a pipe is written asynchronously, and exiting at once cuts
// off the snapshot that --json prints.
if (import.meta.main) process.exitCode = await main();
