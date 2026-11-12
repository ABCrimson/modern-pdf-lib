/**
 * Writes tests/fixtures/pdf20-hash/cases.json: the Encrypt dictionaries of 256 empty documents
 * that qpdf 12.4.2 encrypted with 256-bit keys (R6), each under its own user and owner password.
 * Every file gives two Algorithm 2.B cases (ISO 32000-2 7.6.4.3.4): the user password with the
 * salt in bytes 32-39 of /U, whose hash is bytes 0-31 of /U; and the owner password with the
 * salt in bytes 32-39 of /O and the 48-byte /U as udata, whose hash is bytes 0-31 of /O.
 * tests/oracle/aes.test.ts holds the oracle port tests/helpers/oracle/pdf20-hash.ts to all 512.
 *
 *   node scripts/oracle/pdf20-hash-cases.ts           encrypt 256 empty documents and write cases.json
 *   node scripts/oracle/pdf20-hash-cases.ts --check   exit 1 unless qpdf accepts every committed case
 *
 * Each document is `qpdf --empty --encrypt --user-password=<u> --owner-password=<o> --bits=256 --
 * <out>`. The passwords come from a seeded generator, so they are the same on every run; qpdf
 * draws the salts at random, so the hashes differ on every run, and the write mode replaces the
 * whole file. `--check` therefore cannot compare bytes with a fresh run. Instead it checks that
 * the committed passwords are the seeded ones and that the file has its shape, then rebuilds each
 * empty document from the committed Encrypt dictionary and asks qpdf (`--show-encryption`) to
 * report the committed user password as the user password and the owner password as the owner
 * password.
 *
 * qpdf is `QPDF` when that variable is set, else `qpdf` on PATH. Any version other than 12.4.2
 * is refused. Node strips the types, so only erasable syntax is used here.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QPDF = process.env['QPDF'] ?? 'qpdf';
const QPDF_VERSION = 'qpdf version 12.4.2';
const FILES = 256;
const SEED = 0x2b_0b_76_1a;
/** Printable ASCII, space included: valid UTF-8, so qpdf uses the password bytes as given. */
const ALPHABET = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i)).join(
  '',
);

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const casesPath = join(repoRoot, 'tests/fixtures/pdf20-hash/cases.json');

/** The R6 Encrypt dictionary values of one qpdf-written file, strings as lower-case hex. */
interface CaseFile {
  readonly user: string;
  readonly owner: string;
  readonly P: number;
  readonly U: string;
  readonly O: string;
  readonly UE: string;
  readonly OE: string;
  readonly Perms: string;
}

interface Cases {
  readonly producer: string;
  readonly command: string;
  readonly seed: number;
  readonly files: readonly CaseFile[];
}

/** mulberry32: a small seeded generator, so the passwords are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_00_00_00_00;
  };
}

/**
 * The FILES user/owner password pairs. User passwords are 0-127 bytes long (every eighth one
 * empty), owner passwords 1-127 bytes and never equal to the user password; 127 bytes is the
 * longest password Algorithm 2.B takes.
 */
function passwords(): { user: string; owner: string }[] {
  const next = seeded(SEED);
  const word = (min: number, max: number): string => {
    const length = min + Math.floor(next() * (max - min + 1));
    return Array.from({ length }, () => ALPHABET[Math.floor(next() * ALPHABET.length)]).join('');
  };
  const pairs: { user: string; owner: string }[] = [];
  for (let i = 0; i < FILES; i++) {
    const user = i % 8 === 0 ? '' : word(1, i % 4 === 1 ? 127 : 24);
    let owner = word(1, i % 4 === 3 ? 127 : 24);
    while (owner === user) owner = word(1, 24);
    pairs.push({ user, owner });
  }
  return pairs;
}

/** Runs qpdf; throws with its output on a non-zero exit. */
function qpdf(args: readonly string[]): string {
  const result = spawnSync(QPDF, args, { encoding: 'utf8' });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `qpdf ${args.join(' ')} exited ${result.status}:\n${result.stdout}${result.stderr}`,
    );
  }
  return result.stdout;
}

/** The value of `/key` in the Encrypt dictionary text of a qpdf-written file. */
function entry(text: string, key: string, pattern: string): string {
  const value = new RegExp(`/${key} ${pattern}`).exec(text)?.[1];
  if (value === undefined) throw new Error(`no /${key} in the Encrypt dictionary`);
  return value.toLowerCase();
}

/** Encrypts an empty document under `pair` and reads its Encrypt dictionary. */
function encryptOne(pair: { user: string; owner: string }, out: string): CaseFile {
  qpdf([
    '--empty',
    '--encrypt',
    `--user-password=${pair.user}`,
    `--owner-password=${pair.owner}`,
    '--bits=256',
    '--',
    out,
  ]);
  const text = new TextDecoder('latin1').decode(readFileSync(out));
  return {
    user: pair.user,
    owner: pair.owner,
    P: Number(entry(text, 'P', '(-?\\d+)')),
    U: entry(text, 'U', '<([0-9a-fA-F]+)>'),
    O: entry(text, 'O', '<([0-9a-fA-F]+)>'),
    UE: entry(text, 'UE', '<([0-9a-fA-F]+)>'),
    OE: entry(text, 'OE', '<([0-9a-fA-F]+)>'),
    Perms: entry(text, 'Perms', '<([0-9a-fA-F]+)>'),
  };
}

/** The empty R6 document of `c`, built from literals and the committed Encrypt dictionary. */
function rebuild(c: CaseFile): Uint8Array {
  const objects = [
    '<< /Extensions << /ADBE << /BaseVersion /1.7 /ExtensionLevel 8 >> >> /Pages 2 0 R /Type /Catalog >>',
    '<< /Count 0 /Kids [ ] /Type /Pages >>',
    `<< /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV3 /Length 32 >> >> /Filter /Standard /Length 256 /O <${c.O}> /OE <${c.OE}> /P ${c.P} /Perms <${c.Perms}> /R 6 /StmF /StdCF /StrF /StdCF /U <${c.U}> /UE <${c.UE}> /V 5 >>`,
  ];
  let out = '%PDF-1.7\n';
  const offsets: number[] = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  const id = '0'.repeat(32);
  out += `trailer << /Root 1 0 R /Size ${objects.length + 1} /ID [<${id}><${id}>] /Encrypt 3 0 R >>\n`;
  out += `startxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

/** Every way the committed cases differ from what qpdf and the seeded passwords say. */
function differences(committed: Cases, workDir: string): string[] {
  const bad: string[] = [];
  const expected = passwords();
  if (committed.producer !== QPDF_VERSION) bad.push(`producer ${committed.producer}`);
  if (committed.seed !== SEED) bad.push(`seed ${committed.seed}`);
  if (committed.files.length !== FILES) bad.push(`${committed.files.length} files (want ${FILES})`);
  const hexOf = (bytes: number): RegExp => new RegExp(`^[0-9a-f]{${bytes * 2}}$`);
  for (const [i, c] of committed.files.entries()) {
    const at = `file ${i}`;
    if (c.user !== expected[i]?.user || c.owner !== expected[i]?.owner) {
      bad.push(`${at}: passwords differ from the seeded ones`);
    }
    for (const [key, bytes] of [
      ['U', 48],
      ['O', 48],
      ['UE', 32],
      ['OE', 32],
      ['Perms', 16],
    ] as const) {
      if (!hexOf(bytes).test(c[key])) bad.push(`${at}: /${key} is not ${bytes} bytes of hex`);
    }
    const file = join(workDir, `case-${i}.pdf`);
    writeFileSync(file, rebuild(c));
    for (const [password, role] of [
      [c.user, 'user'],
      [c.owner, 'owner'],
    ] as const) {
      const shown = qpdf([`--password=${password}`, '--show-encryption', file]);
      if (!shown.includes(`Supplied password is ${role} password`)) {
        bad.push(`${at}: qpdf does not take the ${role} password as the ${role} password`);
      }
    }
  }
  return bad;
}

function main(): void {
  const version = spawnSync(QPDF, ['--version'], { encoding: 'utf8' });
  const found = version.status === 0 ? version.stdout.split(/\r?\n/)[0]?.trim() : undefined;
  if (found !== QPDF_VERSION) {
    process.stderr.write(
      `pdf20-hash-cases: ${QPDF_VERSION} is required (set QPDF=<path>); found ${found ?? 'no qpdf'} at ${QPDF}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const workDir = mkdtempSync(join(tmpdir(), 'mpl-pdf20-hash-'));
  try {
    if (process.argv.includes('--check')) {
      const committed = JSON.parse(readFileSync(casesPath, 'utf8')) as Cases;
      const bad = differences(committed, workDir);
      if (bad.length > 0) {
        process.stderr.write(`pdf20-hash cases check failed:\n${bad.join('\n')}\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write(
          `pdf20-hash cases check ok: ${committed.files.length} files, ${committed.files.length * 2} cases accepted by qpdf\n`,
        );
      }
      return;
    }
    const files = passwords().map((pair, i) => encryptOne(pair, join(workDir, `case-${i}.pdf`)));
    const cases: Cases = {
      producer: QPDF_VERSION,
      command:
        'qpdf --empty --encrypt --user-password=<user> --owner-password=<owner> --bits=256 -- <out>',
      seed: SEED,
      files,
    };
    mkdirSync(join(repoRoot, 'tests/fixtures/pdf20-hash'), { recursive: true });
    writeFileSync(casesPath, `${JSON.stringify(cases, null, 2)}\n`);
    process.stdout.write(`wrote ${files.length} files, ${files.length * 2} cases\n`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
