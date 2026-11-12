/**
 * Runs an installed veraPDF over PDF files and prints the conformance table of
 * scripts/conformance/summarize.ts. The nightly workflow (.github/workflows/conformance.yml) calls
 * it on the input set of scripts/conformance/generate.ts; it is also the local entry point.
 *
 *   node scripts/verapdf-validate.ts [--verapdf <path>] [--out <dir>]
 *     (--manifest <manifest.json> | [--flavour <flavour>] <dir-or-file>...)
 *
 * The veraPDF launcher comes from `--verapdf` or the `VERAPDF` variable (as the qpdf tests read
 * `QPDF`); this script downloads nothing, because the pinned, checksum-checked download lives once,
 * in the workflow. With `--manifest`, every veraPDF entry of the manifest is validated against each
 * of its flavours, one veraPDF run per flavour. File and directory arguments (a directory means the
 * `.pdf` files in it) form one run with `--flavour`, or with veraPDF's own flavour detection when
 * `--flavour` is not given.
 *
 * Each run writes veraPDF's `--format json` output to `<out>/verapdf-<flavour>.json` (`auto` when
 * veraPDF detects the flavour); a run that writes no JSON leaves veraPDF's output in
 * `<out>/verapdf-<flavour>.error.txt` instead, and the job log names only that file. `tools.json`
 * records the veraPDF and Java versions, and the
 * summarize module then prints the table and writes `<out>/summary.json`. `--out` defaults to a new
 * temporary directory, whose path is printed.
 *
 * Report-only: veraPDF's exit code (1 when a file is not compliant, 7 when a file does not parse)
 * never decides the result. Exit codes: summarize's (0 when a report was read, 1 when none was),
 * 2 when veraPDF is missing or the arguments are wrong. veraPDF runs through `execFile` with an
 * argument array, so no shell parses a file name. On Windows a `.bat` launcher cannot be started
 * without a shell and is refused; run the script under WSL or Linux there.
 */
import { execFile, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const usage =
  'usage: node scripts/verapdf-validate.ts [--verapdf <path>] [--out <dir>] ' +
  '(--manifest <manifest.json> | [--flavour <flavour>] <dir-or-file>...)';

/** Longest a single veraPDF run may take. */
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

interface Done {
  /** Exit code, or the error code when the process did not start (`ENOENT`). */
  readonly code: number | string;
  readonly stdout: string;
  readonly stderr: string;
}

function run(command: string, args: readonly string[]): Promise<Done> {
  return new Promise((resolveRun) => {
    execFile(
      command,
      args,
      { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: RUN_TIMEOUT_MS },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : (error.code ?? 1);
        resolveRun({ code, stdout, stderr });
      },
    );
  });
}

function fail(message: string, code = 2): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .find((line) => line.trim() !== '')
      ?.trim() ?? ''
  );
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      verapdf: { type: 'string' },
      out: { type: 'string' },
      manifest: { type: 'string' },
      flavour: { type: 'string' },
    },
  });
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\n${usage}`);
}
const { values, positionals } = parsed;

const verapdf = values.verapdf ?? process.env.VERAPDF;
if (verapdf === undefined || verapdf === '') {
  fail('veraPDF not found: pass --verapdf <path> or set VERAPDF to the veraPDF launcher');
}
if (!existsSync(verapdf)) fail(`veraPDF not found at ${verapdf}`);
if (process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(verapdf)) {
  fail(`${verapdf}: a .bat launcher needs a shell, which this script never uses; run it under WSL`);
}

/** Files per flavour; `auto` means no `--flavour` argument. */
const groups = new Map<string, string[]>();
function add(flavour: string, file: string): void {
  groups.set(flavour, [...(groups.get(flavour) ?? []), file]);
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

if (values.manifest !== undefined) {
  const manifest = record(JSON.parse(readFileSync(values.manifest, 'utf8')));
  const base = dirname(resolve(values.manifest));
  for (const item of Array.isArray(manifest.files) ? manifest.files : []) {
    const entry = record(item);
    const { file, flavours } = entry;
    if (entry.oracle !== 'verapdf' || typeof file !== 'string' || !Array.isArray(flavours))
      continue;
    for (const flavour of flavours) {
      if (typeof flavour === 'string') add(flavour, join(base, file));
    }
  }
}
for (const arg of positionals) {
  if (!existsSync(arg)) fail(`${arg}: no such file or directory`);
  const files = statSync(arg).isDirectory()
    ? readdirSync(arg)
        .filter((name) => name.toLowerCase().endsWith('.pdf'))
        .sort()
        .map((name) => join(arg, name))
    : [arg];
  for (const file of files) add(values.flavour ?? 'auto', file);
}
if (groups.size === 0) fail(`no PDF to validate\n${usage}`);

const out = values.out ?? mkdtempSync(join(tmpdir(), 'verapdf-report-'));
mkdirSync(out, { recursive: true });

const version = await run(verapdf, ['--version']);
if (version.code === 'ENOENT') fail(`veraPDF could not be started from ${verapdf}`);
const javaHome = process.env.JAVA_HOME;
const java = await run(javaHome === undefined ? 'java' : join(javaHome, 'bin', 'java'), [
  '-version',
]);
writeFileSync(
  join(out, 'tools.json'),
  `${JSON.stringify(
    {
      verapdf: firstLine(version.stdout).replace(/^veraPDF /, ''),
      java: java.code === 0 ? firstLine(java.stderr) : 'unknown',
    },
    null,
    2,
  )}\n`,
);

for (const [flavour, files] of groups) {
  const args = [
    '--format',
    'json',
    ...(flavour === 'auto' ? [] : ['--flavour', flavour]),
    ...files,
  ];
  const done = await run(verapdf, args);
  let report: unknown;
  try {
    report = JSON.parse(done.stdout);
  } catch {
    report = undefined;
  }
  if (typeof report === 'object' && report !== null && 'report' in report) {
    writeFileSync(join(out, `verapdf-${flavour}.json`), done.stdout);
    process.stderr.write(`veraPDF ${flavour}: ${files.length} file(s), JSON report written\n`);
  } else {
    // No JSON report: keep veraPDF's own output beside the reports for the reader of the artifact
    // (summarize.ts reduces it when the flavour has a withheld row), and none of it in the job log.
    writeFileSync(join(out, `verapdf-${flavour}.error.txt`), `${done.stderr}\n${done.stdout}`);
    process.stderr.write(
      `veraPDF ${flavour}: no JSON report (exit ${String(done.code)}); ` +
        `its output is in verapdf-${flavour}.error.txt\n`,
    );
  }
}
process.stderr.write(`reports in ${out}\n`);

const summarizeScript = fileURLToPath(new URL('conformance/summarize.ts', import.meta.url));
const summarizeArgs = [
  summarizeScript,
  'verapdf',
  out,
  ...(values.manifest === undefined ? [] : ['--manifest', values.manifest]),
];
const child = spawn(process.execPath, summarizeArgs, { stdio: 'inherit' });
child.on('close', (code) => {
  process.exit(code ?? 1);
});
