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
 * The writer stores each of these keys as a byte string, one byte per character: text up to
 * U+00FF reads back, but text beginning like a byte order mark reads as UTF-16 or UTF-8, and
 * text above U+00FF cannot be saved.
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
  '日本語 €',
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

/** Saves `text` in the six keys and asserts that pdf.js, qpdf and the reloaded document read it. */
async function expectInfoReadBack(text: string): Promise<void> {
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

  const objects = qpdfObjects(bytes);
  const infoDict = objects.get(`obj:${String(objects.get('trailer')?.['/Info'])}`) ?? {};
  expect(
    eachKey((key) => qpdfText(infoDict[`/${key}`])),
    `qpdf ${JSON.stringify(text)}`,
  ).toEqual(want);

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

  knownDefect(
    defectKey('tests-unit-core-b-M02', '0.41.0'),
    'text above U+00FF: pdf.js, qpdf and the reloaded document read the six information keys as set',
    {
      failsWith:
        /^UnencodableTextError: A PDF byte string cannot encode "–" \(U\+2013\) at index 5:/,
    },
    async () => {
      for (const text of WIDE_TEXTS) await expectInfoReadBack(text);
    },
  );

  knownDefect(
    defectKey('tests-unit-core-b-M02', '0.41.0'),
    'Latin-1 text that begins like a byte order mark: pdf.js, qpdf and the reloaded document read the six information keys as set',
    { failsWith: /^AssertionError: pdf\.js "þÿab": expected \{ Title: '慢'/ },
    async () => {
      for (const text of MARK_TEXTS) await expectInfoReadBack(text);
    },
  );
});
