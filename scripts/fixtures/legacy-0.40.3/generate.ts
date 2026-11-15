/**
 * Regenerates tests/fixtures/legacy-0.40.3 with the PUBLISHED modern-pdf-lib@0.40.3.
 *
 *   node scripts/fixtures/legacy-0.40.3/generate.ts           write the fixtures and manifest.json
 *   node scripts/fixtures/legacy-0.40.3/generate.ts --check   regenerate into a temp dir and exit 1 unless
 *                                                    every sha256 equals the committed manifest
 *
 * The library is installed from npm into a temp directory outside the repo and verified against
 * the registry integrity below. The clock (Date, Date.now) and the RNG (crypto.getRandomValues)
 * are pinned before the library is imported, and the signed fixture uses the committed test-only
 * key in test-signer.json, so every byte is a pure function of this file and test-signer.json.
 * Node strips the types, so only erasable syntax is used here.
 */
import { execSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PRODUCER = 'modern-pdf-lib@0.40.3';
const PINNED = {
  'node_modules/modern-pdf-lib': {
    version: '0.40.3',
    integrity:
      'sha512-KqpNc6urmEbMZdjWmwZHMDrrxwxjLOQpQKwX1ZI7Kq40gasEPHPGypy9ij4IB9+mfjGNVwfBrnUH1HtOPsK79g==',
  },
  'node_modules/fflate': {
    version: '0.8.3',
    integrity:
      'sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==',
  },
} as const;

const FIXED_MS = Date.UTC(2026, 9, 30, 12, 0, 0);
const USER_PASSWORD = 'user-0403';
const OWNER_PASSWORD = 'owner-0403';
const AUTHOR = 'legacy-0.40.3 generator';
const SIGNER_CN = 'Legacy 0.40.3 Test Signer';
const FIELD_NAME = 'Signature1';
const SUB_FILTER = 'adbe.pkcs7.detached';
const UTF8_TITLE = 'Café — 日本語 ✓';
const UTF8_SUBJECT = 'Übersicht äöü';
const UTF8_PAGE = 'Café naïve été';
const FORM_VALUES = { name: 'Ada Lovelace', agree: true, colour: 'green' } as const;

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureDir = join(repoRoot, 'tests/fixtures/legacy-0.40.3');
const signerPath = fileURLToPath(new URL('test-signer.json', import.meta.url));

interface PdfLike {
  setTitle(title: string): void;
  setAuthor(author: string): void;
  setSubject(subject: string): void;
  setKeywords(keywords: string[]): void;
  setProducer(producer: string): void;
  setCreationDate(date: Date): void;
  addPage(size: [number, number]): {
    drawText(text: string, options: { x: number; y: number; size: number }): void;
  };
  encrypt(options: {
    userPassword: string;
    ownerPassword: string;
    algorithm: 'aes-128' | 'aes-256';
  }): Promise<void>;
  save(options?: { compress?: boolean; objectStreamThreshold?: number }): Promise<Uint8Array>;
  getForm(): {
    getTextField(name: string): { setText(text: string): void };
    getCheckbox(name: string): { check(): void };
    getDropdown(name: string): { select(option: string): void };
  };
}

type Der = Uint8Array<ArrayBuffer>;

interface LegacyLib {
  createPdf(): PdfLike;
  linearizePdf(bytes: Uint8Array): Promise<Uint8Array>;
  signPdf(
    bytes: Uint8Array,
    fieldName: string,
    options: { certificate: Der; privateKey: Der; reason: string; location: string },
  ): Promise<Uint8Array>;
  buildFormFromJsonSchema(schema: object, options: { title: string }): { doc: PdfLike };
  encodeSequence(items: Der[]): Der;
  encodeSet(items: Der[]): Der;
  encodeOID(oid: string): Der;
  encodeUtf8String(value: string): Der;
  encodeContextTag(tag: number, value: Der): Der;
  encodeInteger(bytes: Uint8Array): Der;
  encodeUTCTime(date: Date): Der;
}

interface ManifestEntry {
  file: string;
  sha256: string;
  bytes: number;
  producer: string;
  api: string;
  inputs: Record<string, unknown>;
  expect: Record<string, unknown>;
  notes?: string;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function installLegacy(dir: string): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { 'modern-pdf-lib': '0.40.3' },
    }),
  );
  // A command string runs through the shell, which resolves npm.cmd on Windows (a .cmd file cannot be spawned directly).
  execSync('npm install --ignore-scripts --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
  const lock = JSON.parse(readFileSync(join(dir, 'node_modules/.package-lock.json'), 'utf8')) as {
    packages: Record<string, { version?: string; integrity?: string }>;
  };
  for (const [path, want] of Object.entries(PINNED)) {
    const got = lock.packages[path];
    if (got?.version !== want.version || got.integrity !== want.integrity) {
      throw new Error(
        `${path}: installed ${got?.version} ${got?.integrity}, expected ${want.version} ${want.integrity}`,
      );
    }
  }
}

/** Pins Date and crypto.getRandomValues; returns the function that restores them. */
function pinClockAndRng(): () => void {
  const RealDate = Date;
  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(FIXED_MS);
      else super(...(args as [number]));
    }
    static override now(): number {
      return FIXED_MS;
    }
  }
  globalThis.Date = PinnedDate as unknown as DateConstructor;
  let seed = 0x0403;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (array === null) return array;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < bytes.length; i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        bytes[i] = seed >>> 24;
      }
      return array;
    },
  });
  return () => {
    globalThis.Date = RealDate;
    // The own property shadows Crypto.prototype.getRandomValues; deleting it restores the original.
    Reflect.deleteProperty(globalThis.crypto, 'getRandomValues');
  };
}

function baseDoc(lib: LegacyLib, title: string, pages: readonly string[]): PdfLike {
  const doc = lib.createPdf();
  doc.setTitle(title);
  doc.setAuthor(AUTHOR);
  doc.setProducer('modern-pdf-lib 0.40.3');
  doc.setCreationDate(new Date(FIXED_MS));
  for (const text of pages) {
    const page = doc.addPage([612, 792]);
    page.drawText(text, { x: 72, y: 700, size: 18 });
    // Streams are compressed only when that is smaller, so each page carries filler lines.
    for (let k = 0; k < 20; k++) {
      page.drawText(`filler line ${k} of ${text}`, { x: 72, y: 660 - k * 14, size: 10 });
    }
  }
  return doc;
}

const derLength = (n: number): number[] =>
  n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255];

async function buildCertificate(lib: LegacyLib, spki: Der, pkcs8: Der): Promise<Der> {
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;
  const key = await webcrypto.subtle.importKey('pkcs8', pkcs8, alg, false, ['sign']);
  const name = lib.encodeSequence([
    lib.encodeSet([
      lib.encodeSequence([lib.encodeOID('2.5.4.3'), lib.encodeUtf8String(SIGNER_CN)]),
    ]),
  ]);
  const sigAlgo = lib.encodeSequence([
    lib.encodeOID('1.2.840.113549.1.1.11'),
    new Uint8Array([5, 0]),
  ]);
  const tbs = lib.encodeSequence([
    lib.encodeContextTag(0, new Uint8Array([2, 1, 2])),
    lib.encodeInteger(new Uint8Array([1, 2, 3, 4])),
    sigAlgo,
    name,
    lib.encodeSequence([
      lib.encodeUTCTime(new Date(Date.UTC(2026, 0, 1))),
      lib.encodeUTCTime(new Date(Date.UTC(2046, 0, 1))),
    ]),
    name,
    spki,
  ]);
  const signature = new Uint8Array(await webcrypto.subtle.sign(alg, key, tbs));
  const bits = new Uint8Array(signature.length + 1);
  bits.set(signature, 1);
  return lib.encodeSequence([
    tbs,
    sigAlgo,
    new Uint8Array([0x03, ...derLength(bits.length), ...bits]),
  ]);
}

async function generate(libDir: string, outDir: string): Promise<ManifestEntry[]> {
  const restore = pinClockAndRng();
  try {
    const lib = (await import(
      pathToFileURL(join(libDir, 'node_modules/modern-pdf-lib/dist/index.mjs')).href
    )) as LegacyLib;
    mkdirSync(outDir, { recursive: true });
    const manifest: ManifestEntry[] = [];
    const put = (
      file: string,
      bytes: Uint8Array,
      api: string,
      inputs: Record<string, unknown>,
      expectation: Record<string, unknown>,
      notes?: string,
    ): void => {
      writeFileSync(join(outDir, file), bytes);
      manifest.push({
        file,
        sha256: sha256(bytes),
        bytes: bytes.length,
        producer: PRODUCER,
        api,
        inputs,
        expect: expectation,
        ...(notes === undefined ? {} : { notes }),
      });
    };
    const info = (title: string, subject?: string): Record<string, string> => ({
      Title: title,
      Author: AUTHOR,
      ...(subject === undefined ? {} : { Subject: subject }),
    });

    {
      const pages = ['Legacy page one', 'Legacy page two'];
      const doc = baseDoc(lib, 'raw-deflate', pages);
      put(
        'raw-deflate.pdf',
        await doc.save(),
        'createPdf(); setTitle/setAuthor/setProducer/setCreationDate; addPage([612, 792]); drawText x21 per page; save()',
        { pages },
        { pageCount: 2, info: info('raw-deflate'), pageText: pages },
        'Flate streams are raw DEFLATE (no zlib header).',
      );
    }
    {
      const pages = ['ObjStm page one', 'ObjStm page two'];
      const doc = baseDoc(lib, 'raw-deflate-objstm', pages);
      put(
        'raw-deflate-objstm.pdf',
        await doc.save({ objectStreamThreshold: 1 }),
        'same as raw-deflate.pdf; save({ objectStreamThreshold: 1 })',
        { pages },
        { pageCount: 2, info: info('raw-deflate-objstm'), pageText: pages },
        'Object stream and xref stream, raw DEFLATE.',
      );
    }
    for (const [file, algorithm, V, R, CFM, title] of [
      ['encrypted-r6.pdf', 'aes-256', 5, 6, 'AESV3', 'aes-256'],
      ['encrypted-r4.pdf', 'aes-128', 4, 4, 'AESV2', 'aes-128'],
    ] as const) {
      const pages = [`Encrypted R${R} page`];
      const doc = baseDoc(lib, title, pages);
      await doc.encrypt({ userPassword: USER_PASSWORD, ownerPassword: OWNER_PASSWORD, algorithm });
      put(
        file,
        await doc.save(),
        `same base document; await encrypt({ userPassword, ownerPassword, algorithm: '${algorithm}' }); save()`,
        { pages, algorithm },
        {
          pageCount: 1,
          info: info(title),
          pageText: pages,
          encryption: { V, R, CFM, userPassword: USER_PASSWORD, ownerPassword: OWNER_PASSWORD },
        },
        'Salts and IVs come from the pinned RNG: predictable, test fixtures only.',
      );
    }
    {
      const doc = baseDoc(lib, UTF8_TITLE, [UTF8_PAGE]);
      doc.setSubject(UTF8_SUBJECT);
      doc.setKeywords(['été', 'ascii']);
      put(
        'utf8-strings.pdf',
        await doc.save({ compress: false }),
        'setTitle/setSubject/setKeywords with non-ASCII text; drawText with non-ASCII text; save({ compress: false })',
        { pages: [UTF8_PAGE], keywords: ['été', 'ascii'] },
        { pageCount: 1, info: info(UTF8_TITLE, UTF8_SUBJECT), pageText: [UTF8_PAGE] },
        'Info strings and content-stream text are UTF-8 bytes in literal strings, no BOM.',
      );
    }
    {
      const pages = ['Lin page one', 'Lin page two', 'Lin page three'];
      const doc = baseDoc(lib, 'linearized', pages);
      put(
        'linearized.pdf',
        await lib.linearizePdf(await doc.save()),
        'linearizePdf(await save())',
        { pages },
        { pageCount: 3, info: info('linearized'), pageText: pages, linearized: true },
      );
    }
    {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          agree: { type: 'boolean', title: 'Agree' },
          colour: { type: 'string', enum: ['red', 'green', 'blue'], title: 'Colour' },
        },
        required: ['name'],
      };
      const { doc } = lib.buildFormFromJsonSchema(schema, { title: 'Schema form' });
      const form = doc.getForm();
      form.getTextField('name').setText(FORM_VALUES.name);
      form.getCheckbox('agree').check();
      form.getDropdown('colour').select(FORM_VALUES.colour);
      put(
        'forms.pdf',
        await doc.save(),
        "buildFormFromJsonSchema(schema, { title: 'Schema form' }).doc; getTextField('name').setText; getCheckbox('agree').check; getDropdown('colour').select; save()",
        { schema, values: FORM_VALUES },
        { pageCount: 1, pageText: ['Schema form'], fields: FORM_VALUES },
        'buildFormFromJsonSchema is the only 0.40.3 path that writes /AcroForm: getForm().create* writes no /AcroForm and no widget.',
      );
    }
    {
      const signer = JSON.parse(readFileSync(signerPath, 'utf8')) as {
        pkcs8: string;
        spki: string;
      };
      const pkcs8 = new Uint8Array(Buffer.from(signer.pkcs8, 'base64'));
      const spki = new Uint8Array(Buffer.from(signer.spki, 'base64'));
      const certificate = await buildCertificate(lib, spki, pkcs8);
      const pages = ['Signed page'];
      const doc = baseDoc(lib, 'signed', pages);
      const signed = await lib.signPdf(await doc.save(), FIELD_NAME, {
        certificate,
        privateKey: pkcs8,
        reason: 'legacy fixture',
        location: 'test',
      });
      put(
        'signed.pdf',
        signed,
        `signPdf(await save(), '${FIELD_NAME}', { certificate, privateKey, reason, location })`,
        { pages, certificateDerBase64: Buffer.from(certificate).toString('base64') },
        {
          pageCount: 1,
          info: info('signed'),
          pageText: pages,
          signature: { fieldName: FIELD_NAME, subFilter: SUB_FILTER },
        },
        'Self-signed test certificate, key in scripts/fixtures/legacy-0.40.3/test-signer.json; one incremental update, no /AcroForm in the updated catalog.',
      );
    }
    writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } finally {
    restore();
  }
}

function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const libDir = mkdtempSync(join(tmpdir(), 'mpl-legacy-0.40.3-lib-'));
  const checkDir = check ? mkdtempSync(join(tmpdir(), 'mpl-legacy-0.40.3-out-')) : undefined;
  return (async () => {
    try {
      installLegacy(libDir);
      const manifest = await generate(libDir, checkDir ?? fixtureDir);
      if (checkDir === undefined) {
        // manifest.json lives under tests/, which `pnpm run format:check` covers.
        execSync('pnpm exec oxfmt tests/fixtures/legacy-0.40.3/manifest.json', {
          cwd: repoRoot,
          stdio: 'inherit',
        });
        for (const m of manifest)
          process.stdout.write(`${m.sha256.slice(0, 16)} ${m.bytes} ${m.file}
`);
        return;
      }
      const committed = JSON.parse(
        readFileSync(join(fixtureDir, 'manifest.json'), 'utf8'),
      ) as ManifestEntry[];
      const bad: string[] = [];
      for (const m of manifest) {
        const want = committed.find((c) => c.file === m.file);
        if (want?.sha256 !== m.sha256)
          bad.push(`${m.file}: ${m.sha256} (committed ${want?.sha256})`);
      }
      for (const c of committed) {
        if (!manifest.some((m) => m.file === c.file)) bad.push(`${c.file}: not regenerated`);
      }
      if (JSON.stringify(committed) !== JSON.stringify(manifest))
        bad.push('manifest.json content differs');
      if (bad.length > 0) {
        process.stderr.write(`legacy-0.40.3 check failed:\n${bad.join('\n')}\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write(`legacy-0.40.3 check ok: ${manifest.length} fixtures byte-identical
`);
      }
    } finally {
      rmSync(libDir, { recursive: true, force: true });
      if (checkDir !== undefined) rmSync(checkDir, { recursive: true, force: true });
    }
  })();
}

await main();
