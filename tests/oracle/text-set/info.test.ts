/**
 * Document information text (ISO 32000-2 14.3.3): `setTitle`, `setAuthor`, `setSubject`,
 * `setKeywords`, `setCreator` and `setProducer` set the same text, the file is saved, and pdf.js
 * (`getMetadata().info`), qpdf `--json=2` (the /Info dictionary) and the getters of the reloaded
 * document each report that text for all six keys.
 *
 * The texts are the four inputs of the set (./setup.ts) and 13 titles: ASCII, "Résumé",
 * "€ • —", CJK, an emoji, the bytes of a UTF-16BE, a UTF-16LE and a UTF-8 byte order mark read as
 * Latin-1 text, a TAB, the empty string, the string delimiters, mixed text, and "日本語 €".
 *
 * The writer stores each of these keys as a PDF text string (ISO 32000-2 7.9.2.2): PDFDocEncoding
 * when every character is in it and the bytes do not begin like a byte order mark, else UTF-16BE
 * with FE FF, which qpdf prints as "u:" text. qpdf prints PDFDocEncoding text that holds a byte
 * outside ASCII text, such as 0x18 (breve) or 0x80 and above, as "b:" hex, which qpdfText
 * (./setup.ts) decodes with the library's own decoder, so pdf.js is the independent reader of such
 * text. The getters of a loaded document still return such a key one byte per character, so only
 * Latin-1 text that does not begin like a byte order mark reads back through them.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf, loadPdf } from '../../../src/index.js';
import type { PdfDocument } from '../../../src/index.js';
import { defectKey, knownDefect } from '../../helpers/known-defect.js';
import { withPdfjs } from '../../helpers/oracle/pdfjs.js';
import { requireQpdf } from '../../helpers/oracle/qpdf.js';
import { cleanSave, INPUTS, qpdfObjects, qpdfText } from './setup.js';

const KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'] as const;
type InfoKey = (typeof KEYS)[number];

/** Text of one byte per character, U+0000 to U+00FF, that does not begin like a byte order mark. */
const LATIN1_TEXTS = [INPUTS.ascii, 'Plain ASCII', 'Résumé', 'a\tb', '', 'Paren (x) \\ back'];
/** Text with characters above U+00FF. */
const WIDE_TEXTS = [
  INPUTS.latin,
  INPUTS.cjk,
  INPUTS.astral,
  '€ • —',
  '日本語',
  '🎉 emoji',
  'Ünïcödé 日本 €',
];
/** Latin-1 text whose bytes begin like a UTF-16BE, a UTF-16LE or a UTF-8 byte order mark. */
const MARK_TEXTS = ['þÿab', 'ÿþab', 'ï»¿x'];

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A one-page document whose six information keys all hold `text`. */
function infoDoc(text: string): PdfDocument {
  const doc = createPdf();
  doc.addPage();
  doc.setTitle(text);
  doc.setAuthor(text);
  doc.setSubject(text);
  doc.setKeywords(text);
  doc.setCreator(text);
  doc.setProducer(text);
  return doc;
}

const eachKey = <T>(value: (key: InfoKey) => T): Record<InfoKey, T> =>
  Object.fromEntries(KEYS.map((key) => [key, value(key)])) as Record<InfoKey, T>;

/** The /Info dictionary of `bytes` as qpdf `--json=2` prints it. */
function qpdfInfo(bytes: Uint8Array): Readonly<Record<string, unknown>> {
  const objects = qpdfObjects(bytes);
  return objects.get(`obj:${String(objects.get('trailer')?.['/Info'])}`) ?? {};
}

/** Saves `text` in the six keys and asserts that pdf.js and qpdf read it. */
async function expectInfoWritten(text: string): Promise<Uint8Array> {
  const bytes = await cleanSave(infoDoc(text));
  const want = eachKey(() => text);

  const info = await withPdfjs(
    bytes,
    async (doc) => (await doc.getMetadata()).info as Record<string, unknown>,
  );
  expect(
    eachKey((key) => info[key]),
    `pdf.js ${JSON.stringify(text)}`,
  ).toEqual(want);

  const infoDict = qpdfInfo(bytes);
  expect(
    eachKey((key) => qpdfText(infoDict[`/${key}`])),
    `qpdf ${JSON.stringify(text)}`,
  ).toEqual(want);
  return bytes;
}

/** Saves `text` in the six keys and asserts that pdf.js, qpdf and the reloaded document read it. */
async function expectInfoReadBack(text: string): Promise<void> {
  const bytes = await expectInfoWritten(text);
  const want = eachKey(() => text);
  const reloaded = await loadPdf(bytes);
  expect(
    {
      Title: reloaded.getTitle(),
      Author: reloaded.getAuthor(),
      Subject: reloaded.getSubject(),
      Keywords: reloaded.getKeywords(),
      Creator: reloaded.getCreator(),
      Producer: reloaded.getProducer(),
    },
    `reloaded ${JSON.stringify(text)}`,
  ).toEqual(want);
}

describe('document information text read back by pdf.js and qpdf', () => {
  test('Latin-1 text: pdf.js, qpdf and the reloaded document read the six keys as set', async () => {
    for (const text of LATIN1_TEXTS) await expectInfoReadBack(text);
  });

  test('"日本語 €" is a UTF-16BE text string: qpdf prints it as "u:" text and pdf.js reads it', async () => {
    const text = '日本語 €';
    const infoDict = qpdfInfo(await expectInfoWritten(text));
    expect(eachKey((key) => infoDict[`/${key}`])).toEqual(eachKey(() => `u:${text}`));
  });

  test('text above U+00FF: pdf.js and qpdf read the six keys as set', async () => {
    for (const text of WIDE_TEXTS) await expectInfoWritten(text);
  });

  test('Latin-1 text that begins like a byte order mark: pdf.js and qpdf read the six keys as set', async () => {
    for (const text of MARK_TEXTS) await expectInfoWritten(text);
  });

  knownDefect(
    defectKey('core-document-01', '0.41.0'),
    'text above U+00FF and text that begins like a byte order mark: the reloaded document reads the six information keys as set',
    { failsWith: /^AssertionError: reloaded "日本語 €": expected \{ …\(6\) \} to deeply equal/ },
    async () => {
      for (const text of ['日本語 €', ...WIDE_TEXTS, ...MARK_TEXTS]) {
        await expectInfoReadBack(text);
      }
    },
  );
});
