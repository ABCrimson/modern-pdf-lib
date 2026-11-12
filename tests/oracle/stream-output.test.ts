/**
 * saveAsStream() against outside readers, replacing the self-referential checks of
 * tests/integration/streamOutput.test.ts.
 *
 * For a text document, an image document and a multi-page document,
 * the bytes of `saveAsStream()` equal the bytes of `save()` of a document built alike (fixed
 * dates, `compress: false`), and the streamed bytes pass `qpdf --check` and show the expected
 * text in pdf.js. An encrypted document's `saveAsStream()` throws UnsupportedEncryptionError
 * (the 0.40.5 behaviour); the markers record what is still open: the same three checks with
 * `compress: true` (qpdf rejects the raw deflate data under /FlateDecode), the streamed output of
 * an encrypted document, the save hooks of `doc.use()` plugins, and byte equality with `save()`
 * when `objectStreamThreshold` is set. qpdf comes from `QPDF`, then `PATH`; each test skips
 * with a reason where qpdf is absent locally and fails when `CI` is set.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf, UnsupportedEncryptionError } from '../../src/index.js';
import type { PdfDocument, PdfSaveOptions } from '../../src/index.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import { expectPdfjsText } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, qpdfDecryptQdf, requireQpdf } from '../helpers/oracle/qpdf.js';

const SAMPLE_PNG = join(import.meta.dirname, '../fixtures/images/sample.png');
const PLAIN = { compress: false } as const satisfies PdfSaveOptions;
const EPOCH = new Date('2026-01-01T00:00:00Z');
const latin1 = new TextDecoder('latin1');

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A new document with fixed dates, so two built alike give comparable bytes. */
function datedDoc(): PdfDocument {
  const doc = createPdf();
  doc.setCreationDate(EPOCH);
  doc.setModDate(EPOCH);
  return doc;
}

interface Scenario {
  readonly name: string;
  readonly build: () => Promise<PdfDocument>;
  readonly options: PdfSaveOptions;
  readonly text: readonly string[];
}

const scenarios: readonly Scenario[] = [
  {
    name: 'text',
    build: async () => {
      const doc = datedDoc();
      doc.addPage().drawText('Streamed text', { x: 50, y: 700, size: 14 });
      return doc;
    },
    options: PLAIN,
    text: ['Streamed text'],
  },
  {
    name: 'image',
    build: async () => {
      const doc = datedDoc();
      const page = doc.addPage();
      page.drawText('Streamed image', { x: 50, y: 700, size: 14 });
      const image = await doc.embedPng(new Uint8Array(readFileSync(SAMPLE_PNG)));
      page.drawImage(image, { x: 50, y: 500, width: 100, height: 100 });
      return doc;
    },
    options: PLAIN,
    text: ['Streamed image'],
  },
  {
    name: 'multi-page',
    build: async () => {
      const doc = datedDoc();
      for (const n of [1, 2, 3]) {
        doc.addPage().drawText(`Streamed page ${n}`, { x: 50, y: 700, size: 14 });
      }
      return doc;
    },
    options: PLAIN,
    text: ['Streamed page 1', 'Streamed page 2', 'Streamed page 3'],
  },
];

const collect = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> =>
  new Uint8Array(await new Response(stream).arrayBuffer());

describe('saveAsStream() output', () => {
  test.for(scenarios)(
    '$name: stream bytes equal save() bytes; qpdf clean, pdf.js text equal',
    async ({ build, options, text }) => {
      const saved = await (await build()).save(options);
      const streamed = await collect((await build()).saveAsStream(options));
      expect(streamed).toEqual(saved);
      expectQpdfClean(streamed);
      await expectPdfjsText(streamed, text);
    },
  );
});

describe('saveAsStream() with objectStreamThreshold', () => {
  const options = { ...PLAIN, objectStreamThreshold: 1 } as const satisfies PdfSaveOptions;
  const build = (): PdfDocument => {
    const doc = datedDoc();
    doc.addPage().drawText('Streamed object streams', { x: 50, y: 700, size: 14 });
    return doc;
  };

  test('the streamed output passes qpdf and shows its text in pdf.js', async () => {
    const streamed = await collect(build().saveAsStream(options));
    expectQpdfClean(streamed);
    await expectPdfjsText(streamed, ['Streamed object streams']);
  });

  knownDefect(
    defectKey('oracle-gates-R02', '0.41.2'),
    'stream bytes equal the save() bytes of a document built alike when objectStreamThreshold is set',
    {
      failsWith:
        /^AssertionError: stream bytes vs save\(\) bytes: expected Uint8Array\[.*\] to deeply equal Uint8Array\[/,
    },
    async () => {
      const saved = await build().save(options);
      const streamed = await collect(build().saveAsStream(options));
      expectQpdfClean(saved);
      expectQpdfClean(streamed);
      expect(streamed, 'stream bytes vs save() bytes').toEqual(saved);
    },
  );
});

describe('saveAsStream() with compression', () => {
  const options = { compress: true } as const satisfies PdfSaveOptions;
  // Twenty lines, so the content stream is long enough for the writer to compress it.
  const build = (): PdfDocument => {
    const doc = datedDoc();
    const page = doc.addPage();
    for (let line = 0; line < 20; line++) {
      page.drawText('Streamed compressed text', { x: 50, y: 700 - line * 20, size: 14 });
    }
    return doc;
  };

  // One marker: the oracle guard fails any plain test whose output skips expectQpdfClean(), and
  // qpdf rejects this output today. The byte equality runs first, so a difference from save()
  // is a failure for another reason than failsWith.
  knownDefect(
    defectKey('color-compression-35', '0.40.8'),
    'stream bytes equal save() bytes of a document built alike; qpdf clean, pdf.js text equal',
    {
      failsWith:
        /^QpdfError: qpdf --check exit 2: .*error decoding stream data for object \d+ 0: stream inflate: inflate: data: incorrect header check/,
    },
    async () => {
      const saved = await build().save(options);
      const streamed = await collect(build().saveAsStream(options));
      expect(latin1.decode(streamed)).toContain('/FlateDecode');
      expect(streamed).toEqual(saved);
      expectQpdfClean(streamed);
      await expectPdfjsText(streamed, [Array(20).fill('Streamed compressed text').join(' ')]);
    },
  );
});

describe('saveAsStream() on an encrypted document', () => {
  test('throws UnsupportedEncryptionError', async () => {
    const doc = datedDoc();
    doc.addPage().drawText('Secret page', { x: 50, y: 700, size: 14 });
    await doc.encrypt({ userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-128' });
    expect(() => doc.saveAsStream(PLAIN)).toThrow(UnsupportedEncryptionError);
  });

  knownDefect(
    defectKey('core-document-03', '0.41.2'),
    'the streamed output of an encrypted document passes qpdf --decrypt and holds no plaintext',
    { failsWith: /^UnsupportedEncryptionError: saveAsStream\(\) cannot encrypt/ },
    async () => {
      const doc = datedDoc();
      doc.addPage().drawText('Secret page', { x: 50, y: 700, size: 14 });
      await doc.encrypt({ userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-128' });
      const streamed = await collect(doc.saveAsStream(PLAIN));
      expectQpdfClean(streamed, { password: 'u' });
      expect(latin1.decode(streamed)).not.toContain('Secret page');
      expect(latin1.decode(qpdfDecryptQdf(streamed, 'u'))).toContain('Secret page');
    },
  );
});

describe('saveAsStream() and plugin hooks', () => {
  knownDefect(
    defectKey('tests-integration-e2e-bench-fixtures-M01', '0.41.2'),
    'saveAsStream() runs the onBeforeSave and onAfterSave hooks of a plugin',
    { failsWith: /^AssertionError: expected \[\] to deeply equal \[ 'before', 'after' \]/ },
    async () => {
      const calls: string[] = [];
      const doc = datedDoc();
      doc.addPage().drawText('Hooked page', { x: 50, y: 700, size: 14 });
      doc.use({
        name: 'record-save-hooks',
        onBeforeSave() {
          calls.push('before');
        },
        onAfterSave(bytes) {
          calls.push('after');
          return bytes;
        },
      });
      expectQpdfClean(await collect(doc.saveAsStream(PLAIN)));
      expect(calls).toEqual(['before', 'after']);
    },
  );
});
