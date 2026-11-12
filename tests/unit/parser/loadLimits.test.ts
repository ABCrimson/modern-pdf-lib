/**
 * Loading a PDF whose object stream or cross-reference stream decodes to more than the
 * decoded-stream limit (`maxDecodedStreamBytes`, 256 MiB) throws ResourceLimitError from the load
 * call: the stream is not read as undecoded data, the limit does not start a recovery scan, and
 * the object is not skipped. The files are built here with node:zlib; each is about 1 MB.
 *
 * The other loader limits live here too: the content streams of one page decode to at most the
 * same limit in total, an object stream's header is read pair by pair (the first N pairs), and a
 * page tree deeper than the tree-depth limit (`maxTreeDepth`, 256 levels) throws.
 */
import { Buffer } from 'node:buffer';
import { createDeflate } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { loadPdf } from '../../../src/index.js';
import { ResourceLimitError } from '../../../src/errors.js';
import {
  classicFile,
  objectStreamWithLongHeader,
  pageTreeChain,
  pageWithRepeatedContent,
  plainObject,
  zlibOf,
} from '../../adversarial/load-limits.bodies.js';

const MIB = 1024 * 1024;
const TIMEOUT = 60_000;

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** zlib data of `head` followed by `padMiB` MiB of the byte `pad`, written to a deflate stream a MiB at a time. */
async function zlibWithPadding(head: Uint8Array, padMiB: number, pad: number): Promise<Uint8Array> {
  const deflater = createDeflate({ level: 1 });
  const parts: Buffer[] = [];
  deflater.on('data', (part: Buffer) => parts.push(part));
  const ended = new Promise<void>((done) => deflater.on('end', done));
  deflater.write(head);
  const padding = Buffer.alloc(MIB, pad);
  for (let i = 0; i < padMiB; i++) {
    if (!deflater.write(padding)) await new Promise((done) => deflater.once('drain', done));
  }
  deflater.end();
  await ended;
  return new Uint8Array(Buffer.concat(parts));
}

/** Catalog, page tree and page: members of object stream 1 (objects 2, 3 and 4). */
const MEMBERS = [
  '<< /Type /Catalog /Pages 3 0 R >>',
  '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] >>',
];

interface Padding {
  /** MiB of padding after the object stream's members (spaces, which the object parser skips). */
  readonly objStmMiB: number;
  /** MiB of padding after the cross-reference stream's rows (zero bytes, beyond /Size). */
  readonly xrefMiB: number;
}

/**
 * Build a file with object stream 1 and cross-reference stream 5 (/W [1 2 1], objects 0 to 5),
 * both /FlateDecode without a predictor, each followed by the padding it is given.
 */
async function buildPdf({ objStmMiB, xrefMiB }: Padding): Promise<Uint8Array> {
  let body = '';
  const offsets: number[] = [];
  for (const member of MEMBERS) {
    offsets.push(body.length);
    body += `${member}\n`;
  }
  const header = `2 ${offsets[0]} 3 ${offsets[1]} 4 ${offsets[2]}\n`;
  const objStm = await zlibWithPadding(latin1(header + body), objStmMiB, 0x20);

  const prefix = latin1('%PDF-1.7\n');
  const objStmObject = concat([
    latin1(
      `1 0 obj\n<< /Type /ObjStm /N 3 /First ${header.length} /Length ${objStm.length}` +
        ' /Filter /FlateDecode >>\nstream\n',
    ),
    objStm,
    latin1('\nendstream\nendobj\n'),
  ]);
  const off1 = prefix.length;
  const off5 = off1 + objStmObject.length;

  const rows: [number, number, number][] = [
    [0, 0, 255],
    [1, off1, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 1, 2],
    [1, off5, 0],
  ];
  const table = new Uint8Array(rows.length * 4);
  rows.forEach(([type, field2, field3], i) => {
    table[i * 4] = type;
    table[i * 4 + 1] = (field2 >> 8) & 0xff;
    table[i * 4 + 2] = field2 & 0xff;
    table[i * 4 + 3] = field3;
  });
  const xref = await zlibWithPadding(table, xrefMiB, 0);
  return concat([
    prefix,
    objStmObject,
    latin1(
      `5 0 obj\n<< /Type /XRef /Size 6 /W [1 2 1] /Root 2 0 R /Length ${xref.length}` +
        ' /Filter /FlateDecode >>\nstream\n',
    ),
    xref,
    latin1(`\nendstream\nendobj\nstartxref\n${off5}\n%%EOF\n`),
  ]);
}

/** Run `load` and return what it threw, or `undefined`. */
async function thrown(load: () => Promise<unknown>): Promise<unknown> {
  try {
    await load();
  } catch (err) {
    return err;
  }
  return undefined;
}

const LIMIT = {
  name: 'ResourceLimitError',
  code: 'resource-limit-exceeded',
  limit: 'maxDecodedStreamBytes',
  max: 256 * MIB,
} as const;

describe('load limits', () => {
  it(
    'loads a file whose object stream and cross-reference stream decode up to the limit',
    async () => {
      const doc = await loadPdf(await buildPdf({ objStmMiB: 8, xrefMiB: 8 }));
      expect(doc.getPageCount()).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError when an object stream decodes above the limit',
    async () => {
      const bytes = await buildPdf({ objStmMiB: 257, xrefMiB: 0 });
      expect(bytes.length).toBeLessThan(2 * MIB);
      const err = await thrown(() => loadPdf(bytes));
      expect(err).toBeInstanceOf(ResourceLimitError);
      expect(err).toMatchObject(LIMIT);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError when an object stream decodes above the limit, in a strict load',
    async () => {
      const bytes = await buildPdf({ objStmMiB: 257, xrefMiB: 0 });
      const err = await thrown(() => loadPdf(bytes, { throwOnInvalidObject: true }));
      expect(err).toBeInstanceOf(ResourceLimitError);
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError when a cross-reference stream decodes above the limit',
    async () => {
      const bytes = await buildPdf({ objStmMiB: 0, xrefMiB: 257 });
      expect(bytes.length).toBeLessThan(2 * MIB);
      const err = await thrown(() => loadPdf(bytes));
      expect(err).toBeInstanceOf(ResourceLimitError);
      expect(err).toMatchObject(LIMIT);
    },
    TIMEOUT,
  );
});

describe('page content streams', () => {
  it(
    'throws ResourceLimitError when the content streams of a page decode above the limit together',
    async () => {
      // Nine references to one stream that decodes to 32 MiB: each decode is below the limit.
      const file = pageWithRepeatedContent(await zlibOf(new Uint8Array(0), 32, 0x20), 9);
      expect(file.length).toBeLessThan(2 * MIB);
      const doc = await loadPdf(file);
      let error: unknown;
      try {
        doc.getPage(0).getContentStream();
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ResourceLimitError);
      expect(error).toMatchObject(LIMIT);
    },
    TIMEOUT,
  );

  it('joins content streams that together stay below the limit', async () => {
    const file = pageWithRepeatedContent(await zlibOf(new Uint8Array(0), 1, 0x20), 3);
    const content = (await loadPdf(file)).getPage(0).getContentStream();
    expect(content.length).toBe(3 * (MIB + 1));
  });
});

describe('object stream header', () => {
  it('reads the first N pairs and ignores the tokens after them', async () => {
    const doc = await loadPdf(await objectStreamWithLongHeader(60_000));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 200, height: 200 });
  });
});

describe('page tree', () => {
  it('loads a tree 256 levels deep', async () => {
    expect((await loadPdf(pageTreeChain(256))).getPageCount()).toBe(1);
  });

  it('throws ResourceLimitError for a tree deeper than 256 levels', async () => {
    for (const levels of [257, 50_000]) {
      const err = await thrown(() => loadPdf(pageTreeChain(levels)));
      expect(err).toBeInstanceOf(ResourceLimitError);
      expect(err).toMatchObject({ limit: 'maxTreeDepth', max: 256, actual: 257 });
    }
  });

  it('adds the page once when /Kids names its own node and the page twice', async () => {
    const objects = new Map<number, Uint8Array>([
      [1, plainObject(1, '<< /Type /Catalog /Pages 2 0 R >>')],
      [2, plainObject(2, '<< /Type /Pages /Kids [2 0 R 3 0 R 3 0 R] /Count 1 >>')],
      [3, plainObject(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>')],
    ]);
    const { bytes } = classicFile(objects, () => '/Root 1 0 R');
    expect((await loadPdf(bytes)).getPageCount()).toBe(1);
  });
});
