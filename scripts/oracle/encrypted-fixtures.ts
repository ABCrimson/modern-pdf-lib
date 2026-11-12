/**
 * Writes tests/fixtures/encrypted: a plain source PDF built byte for byte from the literals below
 * and five copies of it encrypted by qpdf 12.4.2, read by tests/oracle/aes.test.ts (G-AES, read
 * direction).
 *
 *   node scripts/oracle/encrypted-fixtures.ts           write the six files and manifest.json
 *   node scripts/oracle/encrypted-fixtures.ts --check   regenerate into a temp dir and exit 1 on
 *                                                       any difference from what is committed
 *
 * qpdf is `QPDF` when that variable is set, else `qpdf` on PATH. Any version other than 12.4.2
 * is refused, because qpdf's output may differ between releases. qpdf runs with its test options
 * `--static-id` and `--static-aes-iv` (`qpdf --help=testing`), and with `--allow-weak-crypto` for
 * the two RC4 copies, which qpdf 12 does not write without it. With those options the R2, R3 and
 * R4 copies are byte-identical between runs, so `--check` compares their SHA-256. qpdf draws the
 * R6 salts at random, so the R6 copy differs between runs: `--check` compares the SHA-256 of the
 * committed R6 file with the manifest, and `qpdf --decrypt --qdf` of the committed file with the
 * same command on a fresh R6 encryption of source.pdf. For the same reason the write mode keeps a
 * committed R6 file that passes that comparison instead of replacing it.
 * Node strips the types, so only erasable syntax is used here.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QPDF = process.env['QPDF'] ?? 'qpdf';
const QPDF_VERSION = 'qpdf version 12.4.2';
const USER_PASSWORD = 'user';
const OWNER_PASSWORD = 'owner';
const TEXT = 'Oracle text';
const TITLE = 'Oracle fixture';
const SOURCE = 'source.pdf';
const R6 = 'aes-256-r6.pdf';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDir = join(repoRoot, 'tests/fixtures/encrypted');

/** One encrypted copy: its file name and the qpdf options that follow `--encrypt`. */
interface Copy {
  readonly file: string;
  readonly weak: boolean;
  readonly encrypt: string;
}

const COPIES: readonly Copy[] = [
  { file: 'rc4-40-r2.pdf', weak: true, encrypt: '--bits=40' },
  { file: 'rc4-128-r3.pdf', weak: true, encrypt: '--bits=128 --use-aes=n' },
  { file: 'aes-128-r4.pdf', weak: false, encrypt: '--bits=128 --use-aes=y' },
  {
    file: 'aes-128-r4-nometa.pdf',
    weak: false,
    encrypt: '--bits=128 --use-aes=y --cleartext-metadata',
  },
  { file: R6, weak: false, encrypt: '--bits=256' },
];

interface ManifestEntry {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  /** How the file is made: `literals` for source.pdf, else the qpdf command line. */
  readonly made: string;
  /** What `--check` compares: the bytes, or (R6) the decrypted QDF form. */
  readonly check: 'sha256' | 'decrypted-qdf';
  /** `qpdf --show-encryption` of the file, one key per line of its output. */
  readonly encryption?: Readonly<Record<string, string>>;
}

interface Manifest {
  readonly producer: string;
  readonly userPassword: string;
  readonly ownerPassword: string;
  readonly text: string;
  readonly title: string;
  readonly files: readonly ManifestEntry[];
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The XMP packet of source.pdf: its title, so the cleartext-metadata copy has metadata to leave clear. */
const XMP = [
  '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>',
  '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
  '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">',
  `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${TITLE}</rdf:li></rdf:Alt></dc:title>`,
  '</rdf:Description>',
  '</rdf:RDF>',
  '</x:xmpmeta>',
  '<?xpacket end="r"?>',
].join('\n');

/** source.pdf: one page showing TEXT in Helvetica, an Info Title and an XMP stream; ASCII only. */
function sourcePdf(): Uint8Array {
  const content = `BT /F1 24 Tf 72 720 Td (${TEXT}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${TITLE}) >>`,
    `<< /Type /Metadata /Subtype /XML /Length ${XMP.length} >>\nstream\n${XMP}\nendstream`,
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
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`;
  out += `startxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(out);
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

/** The qpdf arguments that write `copy` from `input` to `output`. */
function copyArgs(copy: Copy, input: string, output: string): string[] {
  return [
    '--static-id',
    '--static-aes-iv',
    ...(copy.weak ? ['--allow-weak-crypto'] : []),
    input,
    '--encrypt',
    `--user-password=${USER_PASSWORD}`,
    `--owner-password=${OWNER_PASSWORD}`,
    ...copy.encrypt.split(' '),
    '--',
    output,
  ];
}

/** `qpdf --show-encryption` as `key: value` pairs (`R = 4` and `stream encryption method: AESv2` alike). */
function showEncryption(file: string): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const line of qpdf([`--password=${USER_PASSWORD}`, '--show-encryption', file]).split(
    /\r?\n/,
  )) {
    const m = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(line.trim());
    if (m?.[1] !== undefined && m[2] !== undefined) shown[m[1]] = m[2];
  }
  return shown;
}

/** `qpdf --decrypt --qdf` of an encrypted file, normalised with `--static-id`. */
function decryptedQdf(file: string, workDir: string): Uint8Array {
  const out = join(workDir, `qdf-${sha256(readFileSync(file)).slice(0, 16)}.pdf`);
  qpdf([
    `--password=${USER_PASSWORD}`,
    '--decrypt',
    '--qdf',
    '--no-original-object-ids',
    '--static-id',
    file,
    out,
  ]);
  return readFileSync(out);
}

/** Writes source.pdf and the five copies into `outDir`; returns the manifest it also writes there. */
function generate(outDir: string, workDir: string, keepR6From?: string): Manifest {
  mkdirSync(outDir, { recursive: true });
  const source = sourcePdf();
  const sourcePath = join(outDir, SOURCE);
  writeFileSync(sourcePath, source);
  const files: ManifestEntry[] = [
    {
      file: SOURCE,
      sha256: sha256(source),
      bytes: source.length,
      made: 'literals in scripts/oracle/encrypted-fixtures.ts',
      check: 'sha256',
    },
  ];
  for (const copy of COPIES) {
    const output = join(outDir, copy.file);
    qpdf(copyArgs(copy, sourcePath, output));
    const kept = copy.file === R6 && keepR6From !== undefined ? join(keepR6From, R6) : undefined;
    if (
      kept !== undefined &&
      existsSync(kept) &&
      sha256(decryptedQdf(kept, workDir)) === sha256(decryptedQdf(output, workDir))
    ) {
      writeFileSync(output, readFileSync(kept));
    }
    const bytes = readFileSync(output);
    files.push({
      file: copy.file,
      sha256: sha256(bytes),
      bytes: bytes.length,
      made: `qpdf ${copyArgs(copy, SOURCE, copy.file).join(' ')}`,
      check: copy.file === R6 ? 'decrypted-qdf' : 'sha256',
      encryption: showEncryption(output),
    });
  }
  const manifest: Manifest = {
    producer: QPDF_VERSION,
    userPassword: USER_PASSWORD,
    ownerPassword: OWNER_PASSWORD,
    text: TEXT,
    title: TITLE,
    files,
  };
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** Every difference between the committed fixtures and a fresh generation in `freshDir`. */
function differences(fresh: Manifest, freshDir: string, workDir: string): string[] {
  const bad: string[] = [];
  const committedText = readFileSync(join(fixtureDir, 'manifest.json'), 'utf8');
  const committed = JSON.parse(committedText) as Manifest;
  for (const entry of committed.files) {
    const path = join(fixtureDir, entry.file);
    if (!existsSync(path)) {
      bad.push(`${entry.file}: missing`);
      continue;
    }
    const onDisk = sha256(readFileSync(path));
    if (onDisk !== entry.sha256) bad.push(`${entry.file}: ${onDisk} (manifest ${entry.sha256})`);
  }
  for (const entry of fresh.files) {
    const want = committed.files.find((c) => c.file === entry.file);
    if (want === undefined) {
      bad.push(`${entry.file}: not in the committed manifest`);
    } else if (entry.check === 'sha256' && want.sha256 !== entry.sha256) {
      bad.push(`${entry.file}: regenerated ${entry.sha256} (committed ${want.sha256})`);
    } else if (
      entry.check === 'decrypted-qdf' &&
      sha256(decryptedQdf(join(fixtureDir, entry.file), workDir)) !==
        sha256(decryptedQdf(join(freshDir, entry.file), workDir))
    ) {
      bad.push(`${entry.file}: qpdf --decrypt --qdf differs from a fresh encryption`);
    }
  }
  // The R6 bytes are the committed ones by design; everything else in the manifest must match.
  const expected: Manifest = {
    ...fresh,
    files: fresh.files.map((entry) => {
      const want = committed.files.find((c) => c.file === entry.file);
      return entry.check === 'decrypted-qdf' && want !== undefined
        ? { ...entry, sha256: want.sha256, bytes: want.bytes }
        : entry;
    }),
  };
  if (committedText !== `${JSON.stringify(expected, null, 2)}\n`) {
    bad.push('manifest.json content differs from a fresh generation');
  }
  return bad;
}

function main(): void {
  const version = spawnSync(QPDF, ['--version'], { encoding: 'utf8' });
  const found = version.status === 0 ? version.stdout.split(/\r?\n/)[0]?.trim() : undefined;
  if (found !== QPDF_VERSION) {
    process.stderr.write(
      `encrypted-fixtures: ${QPDF_VERSION} is required (set QPDF=<path>); found ${found ?? 'no qpdf'} at ${QPDF}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const check = process.argv.includes('--check');
  const workDir = mkdtempSync(join(tmpdir(), 'mpl-encrypted-fixtures-'));
  try {
    if (!check) {
      // Set the committed R6 file aside before generate() writes over it.
      const keptDir = join(workDir, 'kept');
      mkdirSync(keptDir);
      if (existsSync(join(fixtureDir, R6))) {
        writeFileSync(join(keptDir, R6), readFileSync(join(fixtureDir, R6)));
      }
      const manifest = generate(fixtureDir, workDir, keptDir);
      for (const m of manifest.files) {
        process.stdout.write(`${m.sha256.slice(0, 16)} ${m.bytes} ${m.file}\n`);
      }
      return;
    }
    const freshDir = join(workDir, 'fresh');
    const fresh = generate(freshDir, workDir);
    const bad = differences(fresh, freshDir, workDir);
    if (bad.length > 0) {
      process.stderr.write(`encrypted fixtures check failed:\n${bad.join('\n')}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(
        `encrypted fixtures check ok: ${fresh.files.length} files (${fresh.files.filter((f) => f.check === 'sha256').length} byte-identical, R6 decrypted-identical)\n`,
      );
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
