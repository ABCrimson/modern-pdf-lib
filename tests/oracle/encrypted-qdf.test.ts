/**
 * Decrypted objects equal qpdf's plaintext, object by object.
 *
 * For every file of tests/fixtures/encrypted (R2, R3, R4 with RC4 and AES, R4 without metadata
 * encryption, R5 and R6; object streams off and on; an empty user password; Identity crypt
 * filters; hex and octal-escaped strings; Title bytes 0x80 to 0x9F; a signed file), each object
 * of the library's encrypted load equals the same object of `qpdf --decrypt --qdf
 * --object-streams=disable` output loaded as an unencrypted file (tests/helpers/oracle/
 * qdf-compare.ts states the normalisation). source.pdf, unencrypted, is the control.
 *
 * One documented difference: the /Contents of a signature dictionary is left as stored. This
 * library follows ISO 32000-2 (7.6.1, 12.8.1) and exempts a dictionary whose /Type is /Sig or
 * /DocTimeStamp, or that has no /Type and has /ByteRange and /Contents; qpdf 12.4.2 exempts only
 * /Type /Sig with /ByteRange, and encrypts and decrypts the /Contents of the other three shapes.
 * The load/sig-shapes copies hold all four shapes: for the three, this library returns the
 * /Contents as stored in the file, and qpdf returns the plaintext.
 *
 * Then load, encrypt, save: the library's re-encrypted copy of each source.pdf copy opens in qpdf
 * with the new password (`qpdf --check` clean), and its plaintext (qpdf `--decrypt`, loaded by
 * the library) has the source's page content, text and Title.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PdfRef, extractText, loadPdf, parseContentStream } from '../../src/index.js';
import type { PdfDict, PdfDocument, PdfString } from '../../src/index.js';
import { compareWithQdf, qpdfDecryptQdfMapped } from '../helpers/oracle/qdf-compare.js';
import { latin1String } from '../../src/internal/latin1.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../helpers/oracle/qpdf.js';

const DIR = join(import.meta.dirname, '../fixtures/encrypted');

interface Entry {
  readonly file: string;
  readonly userPasswordCodePoints?: string;
  readonly made: string;
}
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as {
  readonly userPassword: string;
  readonly ownerPassword: string;
  readonly text: string;
  readonly title: string;
  readonly files: readonly Entry[];
  readonly extra: readonly Entry[];
  readonly load: readonly Entry[];
};

/** The user password of `entry`: its code points when listed, else the manifest's. */
function userPasswordOf(entry: Entry): string {
  if (entry.userPasswordCodePoints === undefined) return manifest.userPassword;
  if (entry.userPasswordCodePoints === '') return '';
  return String.fromCodePoint(
    ...entry.userPasswordCodePoints.split(' ').map((u) => Number.parseInt(u.slice(2), 16)),
  );
}

const fixture = (file: string): Uint8Array => new Uint8Array(readFileSync(join(DIR, file)));
const ALL = [...manifest.files, ...manifest.extra, ...manifest.load];

/** The copies of the signature-shapes source, and its signature-like dictionaries by /Name. */
const SHAPES_FILES = ['load/sig-shapes-aes-128-r4.pdf', 'load/sig-shapes-aes-128-r4-nometa.pdf'];
const SHAPES = {
  /** No /Type, with /ByteRange and /Contents: exempt here, encrypted by qpdf. */
  'no-type': { contents: 'no type with byterange', exemptInQpdf: false },
  /** /Type /Sig without /ByteRange: exempt here, encrypted by qpdf. */
  'sig-no-byterange': { contents: 'sig without byterange', exemptInQpdf: false },
  /** /Type /DocTimeStamp: exempt here, encrypted by qpdf. */
  'doc-timestamp': { contents: 'doc timestamp', exemptInQpdf: false },
  /** /Type /Sig with /ByteRange: exempt in both. */
  'sig-byterange': { contents: 'sig with byterange', exemptInQpdf: true },
} as const;

/** The object number of each signature-like dictionary of `doc`, by its /Name string. */
function shapeObjects(doc: PdfDocument): Map<string, number> {
  const found = new Map<string, number>();
  for (const { ref, object } of doc.getRegistry()) {
    const name = object.kind === 'dict' ? (object as PdfDict).get('/Name') : undefined;
    if (name?.kind === 'string' && name.toText() in SHAPES)
      found.set(name.toText(), ref.objectNumber);
  }
  return found;
}

/** The /Contents bytes of object `num` of `doc`. */
const contentsOf = (doc: PdfDocument, num: number): string => {
  const dict = doc.getRegistry().resolve(PdfRef.of(num, 0)) as PdfDict;
  return latin1String((dict.get('/Contents') as PdfString).toBytes());
};

describe('decrypted objects equal qpdf --decrypt --qdf, object by object', () => {
  for (const entry of ALL) {
    const encrypted = entry.file !== 'source.pdf';
    test(entry.file, async (ctx) => {
      requireQpdf(ctx);
      const bytes = fixture(entry.file);
      const password = encrypted ? userPasswordOf(entry) : undefined;
      const mapped = qpdfDecryptQdfMapped(bytes, password);
      expect(mapped.original.size).toBeGreaterThan(0);
      const library = await loadPdf(bytes, password === undefined ? {} : { password });
      const qdf = await loadPdf(mapped.bytes);
      const differences = compareWithQdf(library.getRegistry(), qdf.getRegistry(), mapped);
      // The documented difference: the /Contents of the three shapes qpdf does not exempt.
      const documented = SHAPES_FILES.includes(entry.file)
        ? [...shapeObjects(library)]
            .filter(([name]) => !SHAPES[name as keyof typeof SHAPES].exemptInQpdf)
            .map(([, num]) => `object ${num} 0: /Contents`)
        : [];
      expect(
        differences
          .map((d) => d.split(': library')[0])
          .sort((x, y) =>
            x === y ? 0 : x === undefined ? 1 : y === undefined ? -1 : x < y ? -1 : 1,
          ),
      ).toEqual(documented.sort());
    });
  }
});

describe('signature /Contents: the documented difference from qpdf', () => {
  for (const file of SHAPES_FILES) {
    test(file, async (ctx) => {
      requireQpdf(ctx);
      const bytes = fixture(file);
      const library = await loadPdf(bytes, { password: manifest.userPassword });
      const stored = await loadPdf(bytes, { ignoreEncryption: true });
      const qdf = await loadPdf(qpdfDecryptQdf(bytes, manifest.userPassword));
      const libraryShapes = shapeObjects(library);
      const qdfShapes = shapeObjects(qdf);
      expect([...libraryShapes.keys()].sort()).toEqual(Object.keys(SHAPES).sort());
      expect([...qdfShapes.keys()].sort()).toEqual(Object.keys(SHAPES).sort());
      for (const [name, { contents, exemptInQpdf }] of Object.entries(SHAPES)) {
        const num = libraryShapes.get(name)!;
        // This library: /Contents as stored in the file, for all four shapes.
        expect(contentsOf(library, num), name).toBe(contentsOf(stored, num));
        // qpdf: the plaintext for all four; stored in cleartext only for /Sig with /ByteRange.
        expect(contentsOf(qdf, qdfShapes.get(name)!), name).toBe(contents);
        expect(contentsOf(stored, num) === contents, name).toBe(exemptInQpdf);
      }
    });
  }
});

describe('load, encrypt, save: qpdf opens the copy with the new password', () => {
  // The copies of source.pdf (the signed file and the built files have other content).
  const copies = ALL.filter((e) => e.made.includes('source.pdf') && e.file !== 'source.pdf');
  for (const entry of copies) {
    test(entry.file, async (ctx) => {
      requireQpdf(ctx);
      const doc = await loadPdf(fixture(entry.file), { password: userPasswordOf(entry) });
      await doc.encrypt({
        userPassword: 'again',
        ownerPassword: 'owner-again',
        algorithm: 'aes-256',
      });
      const saved = await doc.save();
      expectQpdfClean(saved, { password: 'again' });
      const plain = await loadPdf(qpdfDecryptQdf(saved, 'again'));
      const content = plain.getPage(0).getContentStream();
      expect(new TextDecoder('latin1').decode(content).trim()).toBe(
        `BT /F1 24 Tf 72 720 Td (${manifest.text}) Tj ET`,
      );
      expect(extractText(parseContentStream(content)).trim()).toBe(manifest.text);
      expect(plain.getTitle()).toBe(manifest.title);
    });
  }
});
