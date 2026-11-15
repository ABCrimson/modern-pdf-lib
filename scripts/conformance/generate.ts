/**
 * Writes the input set of the nightly conformance oracles (.github/workflows/conformance.yml):
 * PDF files made by the library's public writers for veraPDF, signed PDF files for pyHanko, the
 * self-signed certificate of this run's throwaway signer (`signer.pem`) and `manifest.json`, which
 * lists every written file with the writer call and its veraPDF flavours or its signature case.
 *
 *   pnpm exec tsx scripts/conformance/generate.ts --out <dir> [--only verapdf|pyhanko]
 *
 * tsx runs it, not node: it imports the TypeScript source through the public barrel
 * (`src/index.ts`, no build, no dist), and the barrel's relative imports end in `.js`, which
 * node's type stripping does not map to the `.ts` files (`ERR_MODULE_NOT_FOUND`).
 *
 * Every input is an ordinary output of a public call on fixed text, with fixed document dates
 * wherever the API takes a date and `save({ compress: false })` so a reviewer can read the files.
 * The signer is a fresh RSA-2048 key per run, made with WebCrypto; its private key stays in memory
 * and is never written. Its certificate is self-signed with basicConstraints CA:TRUE and keyUsage
 * digitalSignature, nonRepudiation and keyCertSign, so pyHanko can take it as its own trust root,
 * and is valid from one hour before the run for 30 days.
 *
 * The script checks nothing about its outputs: the verdicts belong to the oracles, and the
 * expected verdicts live in scripts/conformance/expected.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { crc32, deflateSync } from 'node:zlib';
import {
  MdpPermission,
  PageSizes,
  addCounterSignature,
  addFieldLock,
  assembleFacturX,
  buildPdfA4Xmp,
  createPdf,
  embedLtvData,
  encodeContextTag,
  encodeInteger,
  encodeLength,
  encodeOID,
  encodeSequence,
  encodeSet,
  encodeUTCTime,
  encodeUtf8String,
  enforcePdfA,
  enforcePdfAFull,
  enforcePdfUa,
  rgb,
  setCertificationLevel,
  signPdf,
  tagHeading,
  tagParagraph,
} from '../../src/index.js';
import type { PdfALevel, PdfDocument, PdfPage, SignOptions } from '../../src/index.js';

/** The oracle a file is written for. */
type Oracle = 'verapdf' | 'pyhanko';

/** One written file of the input set. */
interface ManifestEntry {
  /** File name inside the output directory. */
  readonly file: string;
  readonly oracle: Oracle;
  /** The public call chain that produced the file. */
  readonly writer: string;
  /** veraPDF `--flavour` values this file is validated against (veraPDF inputs only). */
  readonly flavours?: readonly string[];
  /** Signature case (pyHanko inputs only). */
  readonly case?: string;
  /**
   * Signature field names the script passed to signPdf, oldest first (pyHanko inputs only); a
   * field a writer names by itself, such as the one addCounterSignature adds, is not listed.
   */
  readonly fields?: readonly string[];
}

/** A case of the input set that is deliberately not generated, with the reason. */
interface NotRunEntry {
  readonly oracle: Oracle;
  readonly case: string;
  readonly reason: string;
}

interface Manifest {
  readonly schema: 1;
  readonly generatedBy: 'scripts/conformance/generate.ts';
  readonly libraryVersion: string;
  /** The throwaway signer's certificate (PEM), present when the pyHanko inputs were written. */
  readonly signer?: string;
  readonly files: readonly ManifestEntry[];
  readonly notRun: readonly NotRunEntry[];
}

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    only: { type: 'string' },
  },
});

const usage =
  'usage: pnpm exec tsx scripts/conformance/generate.ts --out <dir> [--only verapdf|pyhanko]';
if (values.out === undefined || values.out.length === 0) {
  process.stderr.write(`${usage}\n`);
  process.exit(2);
}
if (values.only !== undefined && values.only !== 'verapdf' && values.only !== 'pyhanko') {
  process.stderr.write(`--only must be verapdf or pyhanko, not "${values.only}"\n${usage}\n`);
  process.exit(2);
}
const outDir = values.out;
const only: Oracle | undefined = values.only;
mkdirSync(outDir, { recursive: true });

/** Document dates written into every input whose writer takes them. */
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

const files: ManifestEntry[] = [];
const notRun: NotRunEntry[] = [];

function write(entry: ManifestEntry, bytes: Uint8Array): void {
  writeFileSync(join(outDir, entry.file), bytes);
  files.push(entry);
}

/** A fresh document with fixed dates and `pages` A4 pages, each carrying one line of text. */
function textDocument(title: string, pages = 1): PdfDocument {
  const doc = createPdf();
  doc.setCreationDate(FIXED_DATE);
  doc.setModDate(FIXED_DATE);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage(PageSizes.A4);
    page.drawText(pages === 1 ? title : `${title}, page ${i + 1}`, {
      x: 50,
      y: 750,
      size: 24,
      color: rgb(0, 0, 0),
    });
  }
  return doc;
}

async function save(doc: PdfDocument): Promise<Uint8Array> {
  return doc.save({ compress: false });
}

/** One PNG chunk: length, type, data and the CRC-32 of type and data. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typed = new Uint8Array(4 + data.length);
  typed.set(new TextEncoder().encode(type), 0);
  typed.set(data, 4);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typed, 4);
  view.setUint32(8 + data.length, crc32(typed));
  return chunk;
}

/** A 2x2 RGBA PNG with one transparent and one half-transparent pixel, so it embeds with /SMask. */
function softMaskedPng(): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 2);
  view.setUint32(4, 2);
  header.set([8, 6, 0, 0, 0], 8); // bit depth 8, colour type 6 (RGBA), deflate, no filter, no interlace
  // Two scanlines, each with filter byte 0 and two RGBA pixels.
  const raw = Uint8Array.from([
    0, 255, 0, 0, 255, 0, 255, 0, 0, 0, 0, 0, 255, 128, 255, 255, 255, 255,
  ]);
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

/** Draw one line of text as a marked-content sequence tied to a new structure element. */
function taggedLine(
  page: PdfPage,
  tag: 'H1' | 'P',
  mcid: number,
  text: string,
  y: number,
  size: number,
): void {
  page.beginMarkedContent(tag, mcid);
  page.drawText(text, { x: 50, y, size, color: rgb(0, 0, 0) });
  page.endMarkedContentSequence();
}

async function writeVeraPdfInputs(): Promise<void> {
  const plain = await save(textDocument('Conformance input'));
  write(
    { file: 'plain.pdf', oracle: 'verapdf', writer: 'createPdf + save', flavours: ['2b'] },
    plain,
  );

  const levels: readonly PdfALevel[] = ['1b', '2b', '3b', '2u', '3u', '1a', '2a', '3a'];
  for (const level of levels) {
    write(
      {
        file: `enforcePdfA-${level}.pdf`,
        oracle: 'verapdf',
        writer: `enforcePdfA(plain, '${level}')`,
        flavours: [level],
      },
      await enforcePdfA(plain, level),
    );
  }
  for (const level of levels) {
    const result = await enforcePdfAFull(plain, level, {
      title: 'Conformance input',
      author: 'modern-pdf-lib conformance',
    });
    write(
      {
        file: `enforcePdfAFull-${level}.pdf`,
        oracle: 'verapdf',
        writer: `enforcePdfAFull(plain, '${level}')`,
        flavours: [level],
      },
      result.bytes,
    );
  }

  // enforcePdfAFull flattens transparency only for part 1 (src/compliance/pdfa/enforcePdfAv2.ts), so
  // the soft-masked image goes through level 1b to reach the transparency flattener.
  {
    const doc = textDocument('Soft-masked image');
    const image = await doc.embedPng(softMaskedPng());
    const page = doc.getPage(0);
    page.drawImage(image, { x: 50, y: 600, width: 100, height: 100 });
    const result = await enforcePdfAFull(await save(doc), '1b', { title: 'Soft-masked image' });
    write(
      {
        file: 'enforcePdfAFull-softmask-1b.pdf',
        oracle: 'verapdf',
        writer: "embedPng(RGBA) + drawImage + save, then enforcePdfAFull(bytes, '1b')",
        flavours: ['1b'],
      },
      result.bytes,
    );
  }

  {
    const doc = textDocument('Invoice INV-2026-0001');
    assembleFacturX(
      doc,
      {
        invoiceNumber: 'INV-2026-0001',
        issueDate: '2026-01-01',
        currency: 'EUR',
        seller: { name: 'Seller GmbH', countryCode: 'DE', vatId: 'DE123456789' },
        buyer: { name: 'Buyer SARL', countryCode: 'FR' },
        lines: [{ description: 'Widget', quantity: 2, unitPrice: 10, taxPercent: 19 }],
      },
      { profile: 'EN16931' },
    );
    write(
      {
        file: 'facturx-en16931.pdf',
        oracle: 'verapdf',
        writer: "assembleFacturX(doc, invoice, { profile: 'EN16931' }) + save",
        flavours: ['3b'],
      },
      await save(doc),
    );
  }

  const pdfA4Levels = [
    ['PDF/A-4', '4', 'pdfa4.pdf'],
    ['PDF/A-4e', '4e', 'pdfa4e.pdf'],
    ['PDF/A-4f', '4f', 'pdfa4f.pdf'],
  ] as const;
  for (const [level, flavour, file] of pdfA4Levels) {
    const doc = textDocument(level);
    doc.setXmpMetadata(buildPdfA4Xmp({ level, title: level }));
    write(
      {
        file,
        oracle: 'verapdf',
        writer: `setXmpMetadata(buildPdfA4Xmp({ level: '${level}' })) + save`,
        flavours: [flavour],
      },
      await save(doc),
    );
  }

  {
    const doc = textDocument('Untagged page');
    enforcePdfUa(doc);
    write(
      {
        file: 'enforcePdfUa-untagged.pdf',
        oracle: 'verapdf',
        writer: 'enforcePdfUa(doc) on an untagged page + save',
        flavours: ['ua1', 'ua2'],
      },
      await save(doc),
    );
  }

  {
    const doc = createPdf();
    doc.setCreationDate(FIXED_DATE);
    doc.setModDate(FIXED_DATE);
    doc.setLanguage('en');
    doc.setTitle('Tagged page');
    const page = doc.addPage(PageSizes.A4);
    const tree = doc.createStructureTree();
    const heading = tagHeading(tree, null, 1);
    taggedLine(page, 'H1', tree.assignMcid(heading, 0), 'Tagged page', 750, 24);
    const paragraph = tagParagraph(tree, null);
    taggedLine(page, 'P', tree.assignMcid(paragraph, 0), 'One tagged paragraph.', 700, 12);
    enforcePdfUa(doc);
    write(
      {
        file: 'enforcePdfUa-tagged.pdf',
        oracle: 'verapdf',
        writer: 'createStructureTree + tagHeading + tagParagraph + enforcePdfUa(doc) + save',
        flavours: ['ua1', 'ua2'],
      },
      await save(doc),
    );
  }
}

/** The throwaway signer of this run: DER certificate and PKCS#8 private key. */
interface Signer {
  readonly certificate: Uint8Array;
  readonly privateKey: Uint8Array;
}

/** DER BIT STRING with no unused bits. */
function bitString(data: Uint8Array): Uint8Array {
  const length = encodeLength(data.length + 1);
  const out = new Uint8Array(1 + length.length + 1 + data.length);
  out[0] = 0x03;
  out.set(length, 1);
  out[1 + length.length] = 0;
  out.set(data, 2 + length.length);
  return out;
}

/** One X.509 extension marked critical, with its DER value wrapped in an OCTET STRING. */
function criticalExtension(oid: string, value: readonly number[]): Uint8Array {
  return encodeSequence([
    encodeOID(oid),
    Uint8Array.from([0x01, 0x01, 0xff]), // critical: BOOLEAN TRUE
    Uint8Array.from([0x04, value.length, ...value]),
  ]);
}

async function makeSigner(): Promise<Signer> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: Uint8Array.from([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  const privateKey = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));

  const sha256WithRsa = encodeSequence([
    encodeOID('1.2.840.113549.1.1.11'),
    Uint8Array.from([0x05, 0x00]),
  ]);
  const name = encodeSequence([
    encodeSet([
      encodeSequence([encodeOID('2.5.4.3'), encodeUtf8String('Conformance Test Signer')]),
    ]),
  ]);
  const notBefore = new Date(Date.now() - 60 * 60 * 1000);
  const notAfter = new Date(notBefore.getTime() + 30 * 24 * 60 * 60 * 1000);
  // basicConstraints: SEQUENCE { cA TRUE }; keyUsage: BIT STRING with digitalSignature (bit 0),
  // nonRepudiation (bit 1) and keyCertSign (bit 5) set, 2 unused bits.
  const extensions = encodeContextTag(
    3,
    encodeSequence([
      criticalExtension('2.5.29.19', [0x30, 0x03, 0x01, 0x01, 0xff]),
      criticalExtension('2.5.29.15', [0x03, 0x02, 0x02, 0xc4]),
    ]),
  );
  const serial = crypto.getRandomValues(new Uint8Array(8));
  serial[0] = (serial[0] ?? 0) & 0x7f; // keep the INTEGER positive
  const tbs = encodeSequence([
    encodeContextTag(0, Uint8Array.from([0x02, 0x01, 0x02])), // version v3
    encodeInteger(serial),
    sha256WithRsa,
    name,
    encodeSequence([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
    name,
    spki,
    extensions,
  ]);
  const signature = new Uint8Array(
    // WebCrypto takes an ArrayBuffer-backed view; the DER encoders return Uint8Array<ArrayBufferLike>.
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new Uint8Array(tbs)),
  );
  return { certificate: encodeSequence([tbs, sha256WithRsa, bitString(signature)]), privateKey };
}

function toPem(der: Uint8Array): string {
  const lines = der.toBase64().match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

async function writePyHankoInputs(): Promise<void> {
  const signer = await makeSigner();
  writeFileSync(join(outDir, 'signer.pem'), toPem(signer.certificate));
  const base = await save(textDocument('Signed input', 2));
  const options = (extra: Partial<SignOptions> = {}): SignOptions => ({
    certificate: signer.certificate,
    privateKey: signer.privateKey,
    ...extra,
  });
  const signed = (file: string, signatureCase: string, writer: string, fields: string[]) => ({
    file,
    oracle: 'pyhanko' as const,
    writer,
    case: signatureCase,
    fields,
  });

  const invisible = await signPdf(base, 'Signature1', options());
  write(
    signed(
      'sign-invisible-sha256.pdf',
      'invisible-sha256',
      "signPdf(base, 'Signature1', { certificate, privateKey })",
      ['Signature1'],
    ),
    invisible,
  );
  for (const hashAlgorithm of ['SHA-384', 'SHA-512'] as const) {
    const bits = hashAlgorithm.slice(4);
    write(
      signed(
        `sign-invisible-sha${bits}.pdf`,
        `invisible-sha${bits}`,
        `signPdf(base, 'Signature1', { hashAlgorithm: '${hashAlgorithm}' })`,
        ['Signature1'],
      ),
      await signPdf(base, 'Signature1', options({ hashAlgorithm })),
    );
  }
  write(
    signed(
      'sign-reason-location-contact.pdf',
      'reason-location-contact',
      "signPdf(base, 'Signature1', { reason, location, contactInfo })",
      ['Signature1'],
    ),
    await signPdf(
      base,
      'Signature1',
      options({
        reason: 'Conformance check',
        location: 'CI runner',
        contactInfo: 'conformance@example.invalid',
      }),
    ),
  );
  const rect: [number, number, number, number] = [50, 50, 200, 60];
  write(
    signed(
      'sign-visible-page0.pdf',
      'visible-page0',
      "signPdf(base, 'Signature1', { appearance: { rect } })",
      ['Signature1'],
    ),
    await signPdf(base, 'Signature1', options({ appearance: { rect } })),
  );
  write(
    signed(
      'sign-visible-page1.pdf',
      'visible-page1',
      "signPdf(base, 'Signature1', { appearance: { pageIndex: 1, rect } })",
      ['Signature1'],
    ),
    await signPdf(base, 'Signature1', options({ appearance: { pageIndex: 1, rect } })),
  );
  {
    const certified = options();
    setCertificationLevel(certified, MdpPermission.NoChanges);
    write(
      signed(
        'sign-certified-docmdp.pdf',
        'certified-docmdp',
        "setCertificationLevel(options, MdpPermission.NoChanges) + signPdf(base, 'Signature1', options)",
        ['Signature1'],
      ),
      await signPdf(base, 'Signature1', certified),
    );
  }
  {
    const locked = options();
    addFieldLock(locked, { action: 'All' });
    write(
      signed(
        'sign-field-lock.pdf',
        'field-lock',
        "addFieldLock(options, { action: 'All' }) + signPdf(base, 'Signature1', options)",
        ['Signature1'],
      ),
      await signPdf(base, 'Signature1', locked),
    );
  }
  write(
    signed('sign-ltv.pdf', 'ltv', 'embedLtvData(sign-invisible-sha256.pdf)', ['Signature1']),
    await embedLtvData(invisible),
  );
  write(
    signed(
      'sign-second-signature.pdf',
      'second-signature',
      "signPdf(sign-invisible-sha256.pdf, 'Signature2', options)",
      ['Signature1', 'Signature2'],
    ),
    await signPdf(invisible, 'Signature2', options()),
  );
  write(
    signed(
      'sign-countersignature.pdf',
      'countersignature',
      'addCounterSignature(sign-invisible-sha256.pdf, 0, { certificate, privateKey })',
      ['Signature1'],
    ),
    await addCounterSignature(invisible, 0, {
      certificate: signer.certificate,
      privateKey: signer.privateKey,
    }),
  );

  notRun.push({
    oracle: 'pyhanko',
    case: 'timestamp-url',
    reason:
      'needs a TSA and the network; the run uses neither, so a timestampUrl case is not generated',
  });
}

if (only !== 'pyhanko') await writeVeraPdfInputs();
if (only !== 'verapdf') await writePyHankoInputs();

const packageJson: unknown = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const libraryVersion =
  typeof packageJson === 'object' &&
  packageJson !== null &&
  'version' in packageJson &&
  typeof packageJson.version === 'string'
    ? packageJson.version
    : 'unknown';

const manifest: Manifest = {
  schema: 1,
  generatedBy: 'scripts/conformance/generate.ts',
  libraryVersion,
  ...(only === 'verapdf' ? {} : { signer: 'signer.pem' }),
  files,
  notRun,
};
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(
  `wrote ${files.length} files (${files.filter((f) => f.oracle === 'verapdf').length} veraPDF, ` +
    `${files.filter((f) => f.oracle === 'pyhanko').length} pyHanko) and manifest.json to ${outDir}\n`,
);
