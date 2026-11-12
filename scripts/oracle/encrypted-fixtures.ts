/**
 * Writes tests/fixtures/encrypted: a plain source PDF built byte for byte from the literals below
 * and five copies of it encrypted by qpdf 12.4.2, read by tests/oracle/aes.test.ts (G-AES, read
 * direction), plus two more AES-256 copies in tests/fixtures/encrypted/extra, read by
 * tests/unit/crypto/r6-derivation.test.ts: `aes-256-r5.pdf` (revision 5, `--force-R5`) and
 * `aes-256-r6-nfkc.pdf`, whose user password U+FB01 x U+00AD A U+FF21 changes under SASLprep.
 * tests/fixtures/encrypted/load holds the files the encrypted-load tests read: qpdf copies with
 * object streams, an R4 RC4 copy, an R4 AES copy with an empty user password, an AES copy of the
 * signed corpus file qpdf-signed.pdf, two R4 AES copies of the signature-shapes source (below), and
 * R4 AESV2 files built here with node:crypto that qpdf does
 * not write (Identity crypt filters, a stream /Crypt filter, hex and octal-escaped strings, Titles
 * with bytes 0x80 to 0x9F), and three files (two R4, one R3) whose content stream /Length is an integer in an
 * object stream that the cross-reference stream lists after the content stream (AESV2 with one
 * and with two EOLs before `endstream`, /V 2 /R 3 RC4 with two). The built files use the
 * file key, /O, /U, /P and /ID of aes-128-r4.pdf and, for AESV2, an IV taken from a SHA-256 of the
 * file and object name, so they are byte-identical between runs. The signature-shapes source, written by this script into its temp directory and never
 * committed, holds four signature-like dictionaries (no /Type with /ByteRange and /Contents,
 * /Type /Sig without /ByteRange, /Type /DocTimeStamp, /Type /Sig with /ByteRange), a catalog
 * /Metadata stream and a page /Metadata stream; one copy encrypts everything, the other is made
 * with `--cleartext-metadata`.
 *
 *   node scripts/oracle/encrypted-fixtures.ts           write every file and manifest.json
 *   node scripts/oracle/encrypted-fixtures.ts --check   regenerate into a temp dir and exit 1 on
 *                                                       any difference from what is committed
 *
 * qpdf is `QPDF` when that variable is set, else `qpdf` on PATH. Any version other than 12.4.2
 * is refused, because qpdf's output may differ between releases. qpdf runs with its test options
 * `--static-id` and `--static-aes-iv` (`qpdf --help=testing`), and with `--allow-weak-crypto` for
 * the two RC4 copies, which qpdf 12 does not write without it. With those options the R2, R3 and
 * R4 copies are byte-identical between runs, so `--check` compares their SHA-256. qpdf draws the
 * R5 and R6 salts at random, so those copies differ between runs: `--check` compares the SHA-256
 * of each committed file with the manifest, and `qpdf --decrypt --qdf` of the committed file with
 * the same command on a fresh encryption of source.pdf. For the same reason the write mode keeps
 * a committed R5 or R6 file that passes that comparison instead of replacing it.
 * Node strips the types, so only erasable syntax is used here.
 */
import { spawnSync } from 'node:child_process';
import { createCipheriv, createHash } from 'node:crypto';
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
/** The subdirectory of the AES-256 copies that tests/oracle/aes.test.ts does not read. */
const EXTRA_DIR = 'extra';
/** The subdirectory of the files the encrypted-load tests read. */
const LOAD_DIR = 'load';
/** U+FB01 (ligature fi), x, U+00AD (soft hyphen), A, U+FF21 (fullwidth A). */
const NFKC_PASSWORD = '\u{FB01}x\u{AD}A\u{FF21}';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDir = join(repoRoot, 'tests/fixtures/encrypted');

/** One encrypted copy: its file name and the qpdf options that follow `--encrypt`. */
interface Copy {
  readonly file: string;
  readonly weak: boolean;
  readonly encrypt: string;
  /** The user password when it is not USER_PASSWORD. */
  readonly userPassword?: string;
  /** Write object streams (`--object-streams=generate`). */
  readonly objstm?: boolean;
  /** The input, relative to tests/fixtures, when it is not source.pdf. */
  readonly input?: string;
  /** The input is the signature-shapes source ({@link shapesPdf}). */
  readonly shapes?: boolean;
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

/** The copies in EXTRA_DIR; their file names include that directory. */
const EXTRA_COPIES: readonly Copy[] = [
  { file: `${EXTRA_DIR}/aes-256-r5.pdf`, weak: false, encrypt: '--bits=256 --force-R5' },
  {
    file: `${EXTRA_DIR}/aes-256-r6-nfkc.pdf`,
    weak: false,
    encrypt: '--bits=256',
    userPassword: NFKC_PASSWORD,
  },
];

/** The copies in LOAD_DIR; their file names include that directory. */
const LOAD_COPIES: readonly Copy[] = [
  { file: `${LOAD_DIR}/rc4-40-r2.objstm.pdf`, weak: true, encrypt: '--bits=40', objstm: true },
  {
    file: `${LOAD_DIR}/rc4-128-r3.objstm.pdf`,
    weak: true,
    encrypt: '--bits=128 --use-aes=n',
    objstm: true,
  },
  { file: `${LOAD_DIR}/rc4-128-r4.pdf`, weak: true, encrypt: '--bits=128 --use-aes=n --force-V4' },
  {
    file: `${LOAD_DIR}/rc4-128-r4.objstm.pdf`,
    weak: true,
    encrypt: '--bits=128 --use-aes=n --force-V4',
    objstm: true,
  },
  {
    file: `${LOAD_DIR}/aes-128-r4.objstm.pdf`,
    weak: false,
    encrypt: '--bits=128 --use-aes=y',
    objstm: true,
  },
  {
    file: `${LOAD_DIR}/aes-128-r4-nometa.objstm.pdf`,
    weak: false,
    encrypt: '--bits=128 --use-aes=y --cleartext-metadata',
    objstm: true,
  },
  { file: `${LOAD_DIR}/aes-256-r6.objstm.pdf`, weak: false, encrypt: '--bits=256', objstm: true },
  {
    file: `${LOAD_DIR}/aes-128-r4.empty.pdf`,
    weak: false,
    encrypt: '--bits=128 --use-aes=y',
    userPassword: '',
  },
  {
    file: `${LOAD_DIR}/signed-aes-128.pdf`,
    weak: false,
    encrypt: '--bits=128 --use-aes=y',
    input: 'corpus/qpdf-signed.pdf',
  },
  {
    file: `${LOAD_DIR}/sig-shapes-aes-128-r4.pdf`,
    weak: false,
    encrypt: '--bits=128 --use-aes=y',
    shapes: true,
  },
  {
    file: `${LOAD_DIR}/sig-shapes-aes-128-r4-nometa.pdf`,
    weak: false,
    encrypt: '--bits=128 --use-aes=y --cleartext-metadata',
    shapes: true,
  },
];

/** The file name of the signature-shapes source in the temp directory. */
const SHAPES = 'sig-shapes.pdf';

/** The file key, /O, /U and /ID of aes-128-r4.pdf (`qpdf --show-encryption-key`). */
const R4_FILE_KEY = '55831911f0f2b9a08ac3cbcc766166db';
const R4_O = '0ba3835f88f90388e74e54584125ce142be0de24c6b0d37746e075b891756671';
const R4_U = '763f954d16622015ee88b60b3eb8f7590021446990b9e4114071a4d9104984c1';
const R4_ID = '31415926535897932384626433832795';

/** One R4 AESV2 file built here: its file name and what differs from the control file. */
interface Built {
  readonly file: string;
  readonly stmF: string;
  readonly strF: string;
  /** The content stream is not encrypted and has `/Filter [/Crypt]` with `/Name /Identity`. */
  readonly streamCryptIdentity?: boolean;
  /** The bytes of the Info /Title before encryption, when they are not TITLE. */
  readonly title?: readonly number[];
}

const BUILT: readonly Built[] = [
  { file: `${LOAD_DIR}/cons-r4-control.pdf`, stmF: 'StdCF', strF: 'StdCF' },
  { file: `${LOAD_DIR}/cons-r4-stmf-identity.pdf`, stmF: 'Identity', strF: 'StdCF' },
  { file: `${LOAD_DIR}/cons-r4-strf-identity.pdf`, stmF: 'StdCF', strF: 'Identity' },
  {
    file: `${LOAD_DIR}/cons-r4-crypt-identity-stream.pdf`,
    stmF: 'StdCF',
    strF: 'StdCF',
    streamCryptIdentity: true,
  },
  {
    file: `${LOAD_DIR}/cons-r4-title-c1.pdf`,
    stmF: 'StdCF',
    strF: 'StdCF',
    title: Array.from({ length: 32 }, (_, i) => 0x80 + i),
  },
  {
    file: `${LOAD_DIR}/cons-r4-title-utf16.pdf`,
    stmF: 'StdCF',
    strF: 'StdCF',
    title: [0xfe, 0xff, 0x00, 0x41, 0x20, 0x14, 0x00, 0x95],
  },
];

/**
 * One file built here whose content stream /Length is an indirect reference to an integer
 * stored in an object stream that comes after the content stream in the cross-reference stream.
 */
interface BuiltLength {
  readonly file: string;
  /** `AESV2`: /V 4 /R 4 with an AESV2 crypt filter; `V2`: /V 2 /R 3, RC4 with the 16-byte file key. */
  readonly cfm: 'AESV2' | 'V2';
  /** What follows the encrypted content stream data before `endstream`. */
  readonly eol: '\n' | '\n\n';
}

const BUILT_LENGTH: readonly BuiltLength[] = [
  { file: `${LOAD_DIR}/cons-r4-length-in-objstm.pdf`, cfm: 'AESV2', eol: '\n' },
  { file: `${LOAD_DIR}/cons-r4-length-in-objstm-2eol.pdf`, cfm: 'AESV2', eol: '\n\n' },
  { file: `${LOAD_DIR}/cons-r3-rc4-length-in-objstm-2eol.pdf`, cfm: 'V2', eol: '\n\n' },
];

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** AESV2 of `data` for object `num` 0 (Algorithm 1 with "sAlT"); the IV is a SHA-256 prefix. */
function aesV2(file: string, num: number, label: string, data: Uint8Array): Uint8Array {
  const objectBytes = Uint8Array.of(num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0);
  const key = createHash('md5')
    .update(concat([Uint8Array.fromHex(R4_FILE_KEY), objectBytes, latin1('sAlT')]))
    .digest();
  const iv = createHash('sha256').update(`${file} ${num} ${label}`).digest().subarray(0, 16);
  const cipher = createCipheriv('aes-128-cbc', key, iv);
  return concat([iv, cipher.update(data), cipher.final()]);
}

/** One R4 AESV2 file: catalog /Lang hex string, Info /Title hex and /Author octal-escaped literal. */
function builtPdf(spec: Built): Uint8Array {
  const str = (num: number, label: string, plain: Uint8Array): Uint8Array =>
    spec.strF === 'Identity' ? plain : aesV2(spec.file, num, label, plain);
  const hex = (b: Uint8Array): string => `<${b.toHex()}>`;
  const octal = (b: Uint8Array): string =>
    `(${Array.from(b, (x) => `\\${x.toString(8).padStart(3, '0')}`).join('')})`;
  const content = latin1(`BT /F1 24 Tf 72 720 Td (${TEXT}) Tj ET`);
  const streamCrypt = spec.streamCryptIdentity === true;
  const streamData =
    streamCrypt || spec.stmF === 'Identity' ? content : aesV2(spec.file, 4, 'stream', content);
  const streamDict = streamCrypt
    ? `/Length ${streamData.length} /Filter [/Crypt] /DecodeParms [<< /Type /CryptFilterDecodeParms /Name /Identity >>]`
    : `/Length ${streamData.length}`;
  const title = spec.title === undefined ? latin1(TITLE) : Uint8Array.from(spec.title);
  const bodies: Uint8Array[] = [
    latin1(`<< /Type /Catalog /Pages 2 0 R /Lang ${hex(str(1, 'Lang', latin1('en-US')))} >>`),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    ),
    concat([latin1(`<< ${streamDict} >>\nstream\n`), streamData, latin1('\nendstream')]),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    latin1(
      `<< /Title ${hex(str(6, 'Title', title))} /Author ${octal(str(6, 'Author', latin1('Author (lit)')))} >>`,
    ),
    latin1(
      `<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV2 /Length 16 >> >> /StmF /${spec.stmF} /StrF /${spec.strF} /O <${R4_O}> /U <${R4_U}> /P -4 >>`,
    ),
  ];
  const header = latin1('%PDF-1.6\n');
  const parts: Uint8Array[] = [header];
  let pos = header.length;
  const offsets: number[] = [];
  for (const [i, body] of bodies.entries()) {
    const chunk = concat([latin1(`${i + 1} 0 obj\n`), body, latin1('\nendobj\n')]);
    offsets.push(pos);
    parts.push(chunk);
    pos += chunk.length;
  }
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R /Info 6 0 R /Encrypt 7 0 R /ID [<${R4_ID}><${R4_ID}>] >>\n`;
  xref += `startxref\n${pos}\n%%EOF\n`;
  parts.push(latin1(xref));
  return concat(parts);
}

/** RC4 of `data` for object `num` 0 with the file key of the R4 files (Algorithm 1; the R3 file shares /O, /U, /P and /ID with them). */
function rc4V2(num: number, data: Uint8Array): Uint8Array {
  const objectBytes = Uint8Array.of(num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0);
  const key = createHash('md5')
    .update(concat([Uint8Array.fromHex(R4_FILE_KEY), objectBytes]))
    .digest();
  const s = Uint8Array.from({ length: 256 }, (_, i) => i);
  const at = (k: number): number => s[k] ?? 0;
  const swap = (a: number, b: number): void => {
    const t = at(a);
    s[a] = at(b);
    s[b] = t;
  };
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + at(i) + (key[i % key.length] ?? 0)) & 0xff;
    swap(i, j);
  }
  let i = 0;
  j = 0;
  return data.map((byte) => {
    i = (i + 1) & 0xff;
    j = (j + at(i)) & 0xff;
    swap(i, j);
    return byte ^ at((at(i) + at(j)) & 0xff);
  });
}

/**
 * One {@link BuiltLength} file: catalog 1, pages 2, page 3, content stream 4 with `/Length 5 0 R`,
 * integer 5 in object stream 6, /Encrypt 7, cross-reference stream 8 (rows in object order).
 */
function builtLengthPdf(spec: BuiltLength): Uint8Array {
  const encrypt = (num: number, label: string, plain: Uint8Array): Uint8Array =>
    spec.cfm === 'AESV2' ? aesV2(spec.file, num, label, plain) : rc4V2(num, plain);
  const content = encrypt(4, 'stream', latin1(`BT /F1 24 Tf 72 720 Td (${TEXT}) Tj ET`));
  const objstm = encrypt(6, 'objstm', latin1(`5 0 ${content.length}`));
  const bodies: Uint8Array[] = [
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> >> /Contents 4 0 R >>',
    ),
    concat([latin1('<< /Length 5 0 R >>\nstream\n'), content, latin1(`${spec.eol}endstream`)]),
    concat([
      latin1(`<< /Type /ObjStm /N 1 /First 4 /Length ${objstm.length} >>\nstream\n`),
      objstm,
      latin1('\nendstream'),
    ]),
    latin1(
      spec.cfm === 'AESV2'
        ? `<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV2 /Length 16 >> >> /StmF /StdCF /StrF /StdCF /O <${R4_O}> /U <${R4_U}> /P -4 >>`
        : `<< /Filter /Standard /V 2 /R 3 /Length 128 /O <${R4_O}> /U <${R4_U}> /P -4 >>`,
    ),
  ];
  const numbers = [1, 2, 3, 4, 6, 7] as const;
  const header = latin1('%PDF-1.6\n');
  const parts: Uint8Array[] = [header];
  let pos = header.length;
  const offsets = new Map<number, number>();
  for (const [num, body] of numbers.map((n, i) => [n, bodies[i] ?? new Uint8Array()] as const)) {
    const chunk = concat([latin1(`${num} 0 obj\n`), body, latin1('\nendobj\n')]);
    offsets.set(num, pos);
    parts.push(chunk);
    pos += chunk.length;
  }
  const row = (type: number, field2: number, field3: number): Uint8Array =>
    Uint8Array.of(
      type,
      (field2 >>> 24) & 0xff,
      (field2 >>> 16) & 0xff,
      (field2 >>> 8) & 0xff,
      field2 & 0xff,
      (field3 >>> 8) & 0xff,
      field3 & 0xff,
    );
  const rows = concat([
    row(0, 0, 65535),
    ...[1, 2, 3, 4].map((num) => row(1, offsets.get(num) ?? 0, 0)),
    row(2, 6, 0),
    row(1, offsets.get(6) ?? 0, 0),
    row(1, offsets.get(7) ?? 0, 0),
    row(1, pos, 0),
  ]);
  parts.push(
    latin1(
      `8 0 obj\n<< /Type /XRef /Size 9 /W [1 4 2] /Root 1 0 R /Encrypt 7 0 R /ID [<${R4_ID}><${R4_ID}>] /Length ${rows.length} >>\nstream\n`,
    ),
    rows,
    latin1(`\nendstream\nendobj\nstartxref\n${pos}\n%%EOF\n`),
  );
  return concat(parts);
}

/** Whether qpdf draws salts for `copy` (R5, R6), so that its bytes differ between runs. */
const randomSalts = (copy: Copy): boolean => copy.encrypt.startsWith('--bits=256');
const userPasswordOf = (copy: Copy): string => copy.userPassword ?? USER_PASSWORD;

interface ManifestEntry {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  /** How the file is made: `literals` for source.pdf, else the qpdf command line. */
  readonly made: string;
  /** What `--check` compares: the bytes, or (R5, R6) the decrypted QDF form. */
  readonly check: 'sha256' | 'decrypted-qdf';
  /** The user password, as code points, when it is not the manifest's `userPassword`. */
  readonly userPasswordCodePoints?: string;
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
  /** The copies under extra/, which tests/oracle/aes.test.ts does not count. */
  readonly extra: readonly ManifestEntry[];
  /** The files under load/, read by the encrypted-load tests. */
  readonly load: readonly ManifestEntry[];
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

/**
 * The signature-shapes source: catalog 1 (with /Metadata 7 and /X8 to /X11 naming the four
 * signature-like dictionaries 8 to 11), pages 2, page 3 (with its own /Metadata 12), font 4,
 * content 5, Info 6. Each signature-like dictionary has a /Name and a literal /Contents; ASCII
 * only.
 */
function shapesPdf(): Uint8Array {
  const content = `BT /F1 24 Tf 72 720 Td (${TEXT}) Tj ET`;
  const pageXmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/">page xmp</x:xmpmeta>';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R /X8 8 0 R /X9 9 0 R /X10 10 0 R /X11 11 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Metadata 12 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${TITLE}) >>`,
    `<< /Type /Metadata /Subtype /XML /Length ${XMP.length} >>\nstream\n${XMP}\nendstream`,
    '<< /Name (no-type) /ByteRange [0 1 2 3] /Contents (no type with byterange) >>',
    '<< /Type /Sig /Name (sig-no-byterange) /Contents (sig without byterange) >>',
    '<< /Type /DocTimeStamp /Name (doc-timestamp) /ByteRange [0 1 2 3] /Contents (doc timestamp) >>',
    '<< /Type /Sig /Name (sig-byterange) /ByteRange [0 1 2 3] /Contents (sig with byterange) >>',
    `<< /Type /Metadata /Subtype /XML /Length ${pageXmp.length} >>\nstream\n${pageXmp}\nendstream`,
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
    // qpdf-signed.pdf draws qpdf warnings of its own (the corpus records `qpdf --check` exit 3).
    ...(copy.input === undefined ? [] : ['--warning-exit-0']),
    input,
    ...(copy.objstm === true ? ['--object-streams=generate'] : []),
    '--encrypt',
    `--user-password=${userPasswordOf(copy)}`,
    `--owner-password=${OWNER_PASSWORD}`,
    ...copy.encrypt.split(' '),
    '--',
    output,
  ];
}

/** `qpdf --show-encryption` as `key: value` pairs (`R = 4` and `stream encryption method: AESv2` alike). */
function showEncryption(file: string, password: string): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const line of qpdf([`--password=${password}`, '--show-encryption', file]).split(/\r?\n/)) {
    const m = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(line.trim());
    if (m?.[1] !== undefined && m[2] !== undefined) shown[m[1]] = m[2];
  }
  return shown;
}

/** `qpdf --decrypt --qdf` of an encrypted file, normalised with `--static-id`. */
function decryptedQdf(file: string, workDir: string, password: string): Uint8Array {
  const out = join(workDir, `qdf-${sha256(readFileSync(file)).slice(0, 16)}.pdf`);
  qpdf([
    `--password=${password}`,
    '--decrypt',
    '--qdf',
    '--no-original-object-ids',
    '--static-id',
    file,
    out,
  ]);
  return readFileSync(out);
}

/** Code points of `text` as `U+XXXX` words. */
const codePoints = (text: string): string =>
  Array.from(
    text,
    (ch) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
  ).join(' ');

/**
 * Writes source.pdf, its copies and the load files into `outDir`; returns the manifest it also writes
 * there. A random-salt copy whose committed file in `keepFrom` decrypts to the same QDF as the
 * fresh one keeps the committed bytes.
 */
function generate(outDir: string, workDir: string, keepFrom?: string): Manifest {
  mkdirSync(join(outDir, EXTRA_DIR), { recursive: true });
  mkdirSync(join(outDir, LOAD_DIR), { recursive: true });
  const source = sourcePdf();
  const sourcePath = join(outDir, SOURCE);
  writeFileSync(sourcePath, source);
  const shapesPath = join(workDir, SHAPES);
  writeFileSync(shapesPath, shapesPdf());
  const files: ManifestEntry[] = [
    {
      file: SOURCE,
      sha256: sha256(source),
      bytes: source.length,
      made: 'literals in scripts/oracle/encrypted-fixtures.ts',
      check: 'sha256',
    },
  ];
  const encryptCopy = (copy: Copy): ManifestEntry => {
    const output = join(outDir, copy.file);
    const password = userPasswordOf(copy);
    const input =
      copy.shapes === true
        ? shapesPath
        : copy.input === undefined
          ? sourcePath
          : join(fixtureDir, '..', copy.input);
    qpdf(copyArgs(copy, input, output));
    const kept =
      randomSalts(copy) && keepFrom !== undefined ? join(keepFrom, copy.file) : undefined;
    if (
      kept !== undefined &&
      existsSync(kept) &&
      sha256(decryptedQdf(kept, workDir, password)) ===
        sha256(decryptedQdf(output, workDir, password))
    ) {
      writeFileSync(output, readFileSync(kept));
    }
    const bytes = readFileSync(output);
    return {
      file: copy.file,
      sha256: sha256(bytes),
      bytes: bytes.length,
      made: `qpdf ${copyArgs(copy, copy.shapes === true ? SHAPES : copy.input === undefined ? SOURCE : `../${copy.input}`, copy.file).join(' ')}`,
      check: randomSalts(copy) ? 'decrypted-qdf' : 'sha256',
      ...(copy.userPassword === undefined
        ? {}
        : { userPasswordCodePoints: codePoints(copy.userPassword) }),
      encryption: showEncryption(output, password),
    };
  };
  files.push(...COPIES.map(encryptCopy));
  const manifest: Manifest = {
    producer: QPDF_VERSION,
    userPassword: USER_PASSWORD,
    ownerPassword: OWNER_PASSWORD,
    text: TEXT,
    title: TITLE,
    files,
    extra: EXTRA_COPIES.map(encryptCopy),
    load: [
      ...LOAD_COPIES.map(encryptCopy),
      ...BUILT.map((spec): ManifestEntry => {
        const bytes = builtPdf(spec);
        writeFileSync(join(outDir, spec.file), bytes);
        const parts = [
          `/StmF /${spec.stmF} /StrF /${spec.strF}`,
          ...(spec.streamCryptIdentity === true ? ['content stream /Crypt /Identity'] : []),
          ...(spec.title === undefined
            ? []
            : [`Title bytes ${Uint8Array.from(spec.title).toHex()}`]),
        ];
        return {
          file: spec.file,
          sha256: sha256(bytes),
          bytes: bytes.length,
          made: `built by scripts/oracle/encrypted-fixtures.ts: ${parts.join(', ')}`,
          check: 'sha256',
          encryption: showEncryption(join(outDir, spec.file), USER_PASSWORD),
        };
      }),
      ...BUILT_LENGTH.map((spec): ManifestEntry => {
        const bytes = builtLengthPdf(spec);
        writeFileSync(join(outDir, spec.file), bytes);
        return {
          file: spec.file,
          sha256: sha256(bytes),
          bytes: bytes.length,
          made: `built by scripts/oracle/encrypted-fixtures.ts: ${spec.cfm === 'AESV2' ? '/V 4 /R 4 /CFM /AESV2' : '/V 2 /R 3 RC4'}, content stream /Length in a later object stream, ${spec.eol.length} EOL before endstream`,
          check: 'sha256',
          encryption: showEncryption(join(outDir, spec.file), USER_PASSWORD),
        };
      }),
    ],
  };
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** Every difference between the committed fixtures and a fresh generation in `freshDir`. */
function differences(fresh: Manifest, freshDir: string, workDir: string): string[] {
  const bad: string[] = [];
  const committedText = readFileSync(join(fixtureDir, 'manifest.json'), 'utf8');
  const committed = JSON.parse(committedText) as Manifest;
  const committedAll = [...committed.files, ...(committed.extra ?? []), ...(committed.load ?? [])];
  const passwordOf = (file: string): string =>
    userPasswordOf(
      [...EXTRA_COPIES, ...LOAD_COPIES].find((c) => c.file === file) ?? {
        file,
        weak: false,
        encrypt: '',
      },
    );
  for (const entry of committedAll) {
    const path = join(fixtureDir, entry.file);
    if (!existsSync(path)) {
      bad.push(`${entry.file}: missing`);
      continue;
    }
    const onDisk = sha256(readFileSync(path));
    if (onDisk !== entry.sha256) bad.push(`${entry.file}: ${onDisk} (manifest ${entry.sha256})`);
  }
  for (const entry of [...fresh.files, ...fresh.extra, ...fresh.load]) {
    const want = committedAll.find((c) => c.file === entry.file);
    if (want === undefined) {
      bad.push(`${entry.file}: not in the committed manifest`);
    } else if (entry.check === 'sha256' && want.sha256 !== entry.sha256) {
      bad.push(`${entry.file}: regenerated ${entry.sha256} (committed ${want.sha256})`);
    } else if (
      entry.check === 'decrypted-qdf' &&
      sha256(decryptedQdf(join(fixtureDir, entry.file), workDir, passwordOf(entry.file))) !==
        sha256(decryptedQdf(join(freshDir, entry.file), workDir, passwordOf(entry.file)))
    ) {
      bad.push(`${entry.file}: qpdf --decrypt --qdf differs from a fresh encryption`);
    }
  }
  // The R5 and R6 bytes are the committed ones by design; everything else in the manifest must
  // match.
  const asCommitted = (entry: ManifestEntry): ManifestEntry => {
    const want = committedAll.find((c) => c.file === entry.file);
    return entry.check === 'decrypted-qdf' && want !== undefined
      ? { ...entry, sha256: want.sha256, bytes: want.bytes }
      : entry;
  };
  const expected: Manifest = {
    ...fresh,
    files: fresh.files.map(asCommitted),
    extra: fresh.extra.map(asCommitted),
    load: fresh.load.map(asCommitted),
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
      // Set the committed R5 and R6 files aside before generate() writes over them.
      const keptDir = join(workDir, 'kept');
      mkdirSync(join(keptDir, EXTRA_DIR), { recursive: true });
      mkdirSync(join(keptDir, LOAD_DIR), { recursive: true });
      for (const copy of [...COPIES, ...EXTRA_COPIES, ...LOAD_COPIES].filter(randomSalts)) {
        if (existsSync(join(fixtureDir, copy.file))) {
          writeFileSync(join(keptDir, copy.file), readFileSync(join(fixtureDir, copy.file)));
        }
      }
      const manifest = generate(fixtureDir, workDir, keptDir);
      for (const m of [...manifest.files, ...manifest.extra, ...manifest.load]) {
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
        `encrypted fixtures check ok: ${fresh.files.length + fresh.extra.length + fresh.load.length} files (${[...fresh.files, ...fresh.extra, ...fresh.load].filter((f) => f.check === 'sha256').length} byte-identical, R5 and R6 decrypted-identical)\n`,
      );
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
