/**
 * Stream data framing through the document load: the stream data of every fixture is unchanged
 * from what 0.40.8 read (the base section of the record), every object that 0.40.8 dropped now
 * loads with the data qpdf reads, no in-use object of a fixture is dropped, and the constructed
 * /Length matrix loads to the bytes its rule gives, leniently and strictly.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PdfRef, PdfStream } from '../../../src/core/pdfObjects.js';
import { loadPdf } from '../../../src/index.js';
import { PdfDocumentParser } from '../../../src/parser/documentParser.js';
import { PdfParseError } from '../../../src/parser/parseError.js';
import { nestedObjectStreamLengths } from '../../adversarial/stream-length.bodies.js';
import {
  CONTENT,
  CONTENT_BYTES,
  LENGTH_CASES,
  contentPdf,
  indirectLengthInObjectStream,
  latin1,
} from '../../helpers/streamLengthFixtures.js';

const fixtureRoot = fileURLToPath(new URL('../../fixtures/', import.meta.url));

interface FileRecord {
  readonly loads: boolean;
  readonly streams: Record<string, { readonly sha256: string }>;
  readonly dropped: Record<string, { readonly qpdfSha256: string | null }>;
}

interface DigestRecord {
  readonly base: { readonly files: Record<string, FileRecord> };
  readonly added: { readonly files: Record<string, FileRecord> };
}

const recorded = JSON.parse(
  readFileSync(join(fixtureRoot, 'expected/stream-digests.json'), 'utf8'),
) as DigestRecord;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The parser's loaded-object state, which the load keeps in two private fields. */
interface ParserState {
  readonly xrefEntries: Map<number, { readonly type: string }>;
  readonly objectCache: Map<number, unknown>;
}

async function loadState(file: string) {
  const parser = new PdfDocumentParser(new Uint8Array(readFileSync(join(fixtureRoot, file))));
  await parser.parse({ ignoreEncryption: true });
  const { xrefEntries, objectCache } = parser as unknown as ParserState;
  return { xrefEntries, objectCache };
}

const recordedFiles = { ...recorded.base.files, ...recorded.added.files };
const files = Object.entries(recordedFiles).filter(([, record]) => record.loads);

describe('fixture streams', () => {
  it('records every fixture', () => {
    const onDisk = readdirSync(fixtureRoot, { recursive: true, encoding: 'utf8' }).filter((name) =>
      name.toLowerCase().endsWith('.pdf'),
    );
    expect(Object.keys(recordedFiles).toSorted()).toEqual(
      onDisk.map((name) => name.replaceAll('\\', '/')).toSorted(),
    );
    expect(Object.keys(recorded.base.files).some((file) => file in recorded.added.files)).toBe(
      false,
    );
  });

  it.each(files)('keeps the recorded stream data of %s', async (file, record) => {
    const { objectCache } = await loadState(file);
    for (const [objNum, expected] of Object.entries(record.streams)) {
      const object = objectCache.get(Number(objNum));
      expect(object, `object ${objNum}`).toBeInstanceOf(PdfStream);
      expect(sha256((object as PdfStream).data), `object ${objNum}`).toBe(expected.sha256);
    }
  });

  const formerlyDropped = Object.entries(recorded.base.files).filter(
    ([, record]) => Object.keys(record.dropped).length > 0,
  );

  it('recorded the objects that 0.40.8 dropped', () => {
    const count = formerlyDropped.reduce((n, [, r]) => n + Object.keys(r.dropped).length, 0);
    expect(count).toBe(149);
  });

  it.each(formerlyDropped)(
    'loads the objects 0.40.8 dropped from %s with the data qpdf reads',
    async (file, record) => {
      const { objectCache } = await loadState(file);
      for (const [objNum, expected] of Object.entries(record.dropped)) {
        if (expected.qpdfSha256 === null) continue;
        const object = objectCache.get(Number(objNum));
        expect(object, `object ${objNum}`).toBeInstanceOf(PdfStream);
        expect(sha256((object as PdfStream).data), `object ${objNum}`).toBe(expected.qpdfSha256);
      }
    },
  );

  it.each(files)('drops no in-use object of %s', async (file) => {
    const { xrefEntries, objectCache } = await loadState(file);
    const dropped: number[] = [];
    for (const [objNum, entry] of xrefEntries) {
      if (entry.type !== 'in-use' && entry.type !== 'compressed') continue;
      if (!objectCache.has(objNum)) dropped.push(objNum);
    }
    expect(dropped).toEqual([]);
  });
});

/** The data of object 4 (the content stream) after a load; empty when the load dropped it. */
const contentOf = async (bytes: Uint8Array, strict: boolean): Promise<Uint8Array> => {
  const doc = await loadPdf(bytes, strict ? { throwOnInvalidObject: true } : {});
  const object = doc.getPage(0).getRegistry().resolve(PdfRef.of(4, 0));
  return object instanceof PdfStream ? object.data : new Uint8Array();
};

describe.each([
  ['classic xref', (c: (typeof LENGTH_CASES)[number]) => c.bytes],
  ['recovery scan', (c: (typeof LENGTH_CASES)[number]) => c.scanBytes],
])('constructed /Length matrix, %s', (_label, pick) => {
  it.each(LENGTH_CASES.map((c) => [c.name, c] as const))('%s: lenient load', async (_n, c) => {
    expect(await contentOf(pick(c), false)).toEqual(c.expected);
  });

  it.each(LENGTH_CASES.map((c) => [c.name, c] as const))('%s: strict load', async (_n, c) => {
    if (c.trusted) {
      expect(await contentOf(pick(c), true)).toEqual(c.expected);
    } else {
      await expect(contentOf(pick(c), true)).rejects.toBeInstanceOf(PdfParseError);
    }
  });
});

describe('indirect /Length inside an object stream', () => {
  it('loads leniently and strictly to the content bytes', async () => {
    const bytes = indirectLengthInObjectStream();
    expect(await contentOf(bytes, false)).toEqual(CONTENT_BYTES);
    expect(await contentOf(bytes, true)).toEqual(CONTENT_BYTES);
  });
});

describe('what lies between the declared data and endstream', () => {
  const L = CONTENT.length;
  const framed = (between: string): Uint8Array =>
    contentPdf(`<< /Length ${L} >>\nstream\n${CONTENT}${between}endstream`);

  it.each([
    ['a comment', '\n% a comment\n'],
    ['a comment ended by CR', '\r% a comment\r'],
    ['two comments', ' % one\n\t% two\n'],
    ['5000 spaces', ' '.repeat(5000)],
    ['5000 line feeds', '\n'.repeat(5000)],
    ['65,000 spaces', ' '.repeat(65_000)],
    ['white space around a comment', `${' '.repeat(5000)}%c\n${' '.repeat(5000)}`],
  ])('takes the declared bytes after %s, leniently and strictly', async (_name, between) => {
    const bytes = framed(between);
    expect(await contentOf(bytes, false)).toEqual(CONTENT_BYTES);
    expect(await contentOf(bytes, true)).toEqual(CONTENT_BYTES);
  });

  it('recovers when something else than white space or a comment follows the data', async () => {
    const bytes = framed('\n% c\nx\n');
    expect(await contentOf(bytes, false)).toEqual(
      Uint8Array.from([...CONTENT_BYTES, ...latin1('\n% c\nx')]),
    );
    await expect(contentOf(bytes, true)).rejects.toBeInstanceOf(PdfParseError);
  });
});

describe('a stream that is framed twice', () => {
  const L = CONTENT.length;
  const gapped = `<< /Length ${L} >>\nstream\n${CONTENT}${' '.repeat(9000)}\nendstream`;

  it('keeps its declared length when the recovery scan parses each object twice', async () => {
    const good = contentPdf(gapped, [[5, gapped]]);
    const broken = latin1(
      String.fromCharCode(...good).replace(/startxref\n\d+/, 'startxref\n999999'),
    );
    for (const strict of [false, true]) {
      const doc = await loadPdf(broken.slice(), strict ? { throwOnInvalidObject: true } : {});
      const registry = doc.getRegistry();
      for (const n of [4, 5]) {
        const object = registry.resolve(PdfRef.of(n, 0));
        expect(object instanceof PdfStream ? object.data.length : -1, `object ${n}`).toBe(L);
      }
    }
  });
});

describe('a chain of indirect lengths through object streams', () => {
  const BT_ET = latin1('BT ET');

  it('loads strictly to the content when every length is right', async () => {
    const bytes = nestedObjectStreamLengths(2, 5);
    expect(await contentOf(bytes, true)).toEqual(BT_ET);
    expect(await contentOf(bytes, false)).toEqual(BT_ET);
  });

  it('loads strictly when the chain is deeper', async () => {
    expect(await contentOf(nestedObjectStreamLengths(4, 5), true)).toEqual(BT_ET);
  });
});
