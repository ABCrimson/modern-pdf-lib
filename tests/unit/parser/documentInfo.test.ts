/**
 * The document information of a loaded file is text (ISO 32000-2 14.3.3: every key but /Trapped
 * is a text string or a date, and a text string is PDFDocEncoding, UTF-16BE with a byte order
 * mark, or UTF-8 with a byte order mark, 7.9.2.2).
 *
 * The files are built by hand, so each key holds the exact bytes a writer other than this library
 * chose. `loadPdf` decodes them with the rule of `PdfString.toText`: `getTitle` and the other
 * getters return the text, not the bytes as one character each.
 *
 * Saving a loaded file writes every /Info value that no setter changed with the bytes and the form
 * (literal or hex) it was loaded with, on every save route, also after decryption and
 * re-encryption; a value a setter changed is written anew as a text string. qpdf `--json=2` is the
 * oracle of the bytes: it prints a string as "u:" text or "b:" hex, both exact.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import type { PdfDocument } from '../../../src/core/pdfDocument.js';
import { PdfRef, PdfString } from '../../../src/core/pdfObjects.js';
import type { PdfDict } from '../../../src/core/pdfObjects.js';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { latin1String } from '../../../src/internal/latin1.js';
import {
  expectQpdfClean,
  QPDF_BIN,
  QpdfError,
  qpdfDecryptQdf,
  requireQpdf,
} from '../../helpers/oracle/qpdf.js';
import { qpdfObjects, qpdfText } from '../../oracle/text-set/setup.js';
import type { QpdfDict } from '../../oracle/text-set/setup.js';

/** The bytes of `text` in UTF-16BE with the FE FF byte order mark, as PDF hex digits. */
function utf16beHex(text: string): string {
  let digits = 'FEFF';
  for (let i = 0; i < text.length; i++) {
    digits += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return `<${digits}>`;
}

/** The bytes of `text` in UTF-8 with the EF BB BF byte order mark, as a literal string syntax. */
function utf8Literal(text: string): string {
  return `(\xEF\xBB\xBF${latin1String(new TextEncoder().encode(text))})`;
}

/**
 * A one-page file whose /Info holds `entries` (a key to the PDF syntax of its value; a character
 * is a byte, U+0000 to U+00FF), with a classic cross-reference table.
 */
function infoPdf(entries: Readonly<Record<string, string>>): Uint8Array {
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>>>',
    `<<${Object.entries(entries)
      .map(([key, syntax]) => `/${key}${syntax}`)
      .join('')}>>`,
  ];
  let file = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, '0')} 00000 n \n`;
  file += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R/Info 4 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(file, (c) => c.charCodeAt(0));
}

const KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'] as const;

/** The six text getters of a loaded document, in the order of {@link KEYS}. */
async function infoTexts(file: Uint8Array): Promise<(string | undefined)[]> {
  const doc = await loadPdf(file);
  return [
    doc.getTitle(),
    doc.getAuthor(),
    doc.getSubject(),
    doc.getKeywords(),
    doc.getCreator(),
    doc.getProducer(),
  ];
}

const ALL_KEYS = (syntax: string): Record<string, string> =>
  Object.fromEntries(KEYS.map((key) => [key, syntax]));

describe('loadPdf: the information dictionary is text', () => {
  it('reads UTF-16BE strings, in hex form, as text for all six keys', async () => {
    const text = 'Résumé 日本語 😀';
    expect(await infoTexts(infoPdf(ALL_KEYS(utf16beHex(text))))).toEqual(KEYS.map(() => text));
  });

  it('reads UTF-8 strings with a byte order mark, in literal form, as text for all six keys', async () => {
    const text = 'Résumé 日本語 😀';
    expect(await infoTexts(infoPdf(ALL_KEYS(utf8Literal(text))))).toEqual(KEYS.map(() => text));
  });

  it('reads PDFDocEncoding by Annex D, not as Latin-1', async () => {
    // 0xE9 is "é" in both; 0x80 is the bullet U+2022 in PDFDocEncoding (U+0080 in Latin-1) and
    // 0xA0 is the euro sign U+20AC (a no-break space in Latin-1).
    const file = infoPdf({ Title: '(Caf\xE9 \x80 \xA0)' });
    expect((await infoTexts(file))[0]).toBe('Café • €');
  });

  it('reads a UTF-16BE date', async () => {
    const date = 'D:20240102030405Z';
    const doc = await loadPdf(
      infoPdf({ CreationDate: utf16beHex(date), ModDate: utf16beHex(date) }),
    );
    expect(doc.getCreationDate()?.toISOString()).toBe('2024-01-02T03:04:05.000Z');
    expect(doc.getModDate()?.toISOString()).toBe('2024-01-02T03:04:05.000Z');
  });

  it('reads a UTF-16LE string (FF FE) as text', async () => {
    const doc = await loadPdf(infoPdf({ Title: '(\xFF\xFEA\x00\xE9\x00)' }));
    expect(doc.getTitle()).toBe('Aé');
  });
});

/** PDFDocEncoding bytes 0x80 to 0xFF, one each, in literal form (0x9F and 0xAD have no character). */
const HIGH_BYTES = `(${String.fromCharCode(...Array.from({ length: 128 }, (_, i) => 0x80 + i))})`;

/** An /Info that a writer other than this library wrote, with every encoding and both forms. */
const SOURCE = infoPdf({
  Title: HIGH_BYTES,
  Author: utf16beHex('日本 €'),
  Subject: utf8Literal('Résumé 日本語 😀'),
  // "Résumé" in PDFDocEncoding, in hex form.
  Keywords: '<52E973756DE9>',
  // UTF-16LE, which a reader decodes and no writer writes.
  Creator: '(\xFF\xFEA\x00b\x00)',
  Producer: '(Other writer 1.0)',
  CreationDate: "(D:20200102030405+02'00')",
  ModDate: "(D:20210102030405-05'00')",
  Trapped: '/False',
  Custom: '(caf\xE9)',
});

/** The /Info dictionary of an unencrypted file, as qpdf `--json=2` reads it. */
function qpdfInfo(bytes: Uint8Array): QpdfDict {
  const objects = qpdfObjects(bytes);
  const info = objects.get(`obj:${String(objects.get('trailer')?.['/Info'])}`);
  expect(info, 'the trailer names an /Info dictionary').toBeDefined();
  return info ?? {};
}

/** The /Info dictionary of an unencrypted file as loadPdf reads it, found by the trailer qpdf reads. */
async function loadedInfo(bytes: Uint8Array): Promise<PdfDict> {
  const [objectNumber = 0, generation = 0] = String(qpdfObjects(bytes).get('trailer')?.['/Info'])
    .split(' ')
    .map(Number);
  const info = (await loadPdf(bytes)).getRegistry().resolve(PdfRef.of(objectNumber, generation));
  return info?.kind === 'dict' ? info : expect.unreachable('the trailer names an /Info dictionary');
}

/** The written form of each string of the /Info of `bytes`: true for hex. */
async function infoForms(bytes: Uint8Array): Promise<Record<string, boolean>> {
  const forms: Record<string, boolean> = {};
  for (const [key, value] of await loadedInfo(bytes)) {
    if (value.kind === 'string') forms[key] = value.hex;
  }
  return forms;
}

/** `bytes` encrypted by qpdf with AES-256 and the user password "user". */
function qpdfEncrypted(bytes: Uint8Array): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), 'document-info-'));
  try {
    const input = join(dir, 'in.pdf');
    const output = join(dir, 'out.pdf');
    writeFileSync(input, bytes);
    const result = spawnSync(
      QPDF_BIN,
      [
        '--encrypt',
        '--user-password=user',
        '--owner-password=owner',
        '--bits=256',
        '--',
        input,
        output,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0)
      throw new QpdfError(`qpdf --encrypt exit ${result.status}: ${result.stderr}`);
    return new Uint8Array(readFileSync(output));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const readStream = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> =>
  new Uint8Array(await new Response(stream).arrayBuffer());

/** A save route: how the document is loaded, and how its saved bytes are turned into clear text. */
interface Route {
  readonly load: () => Promise<PdfDocument>;
  readonly write: (doc: PdfDocument) => Promise<Uint8Array>;
  /** False for a route whose file qpdf decrypts first; its form is the writer's, not the source's. */
  readonly clear: boolean;
}

const NEW_PASSWORDS = { userPassword: 'u2', ownerPassword: 'o2' } as const;

const ROUTES: Readonly<Record<string, Route>> = {
  'save()': { load: () => loadPdf(SOURCE), write: (doc) => doc.save(), clear: true },
  'save({ compress: false })': {
    load: () => loadPdf(SOURCE),
    write: (doc) => doc.save({ compress: false }),
    clear: true,
  },
  'saveAsStream()': {
    load: () => loadPdf(SOURCE),
    write: (doc) => readStream(doc.saveAsStream()),
    clear: true,
  },
  'copy() then save()': {
    load: () => loadPdf(SOURCE),
    write: async (doc) => (await doc.copy()).save(),
    clear: true,
  },
  'encrypt() then save()': {
    load: () => loadPdf(SOURCE),
    write: async (doc) => {
      await doc.encrypt({ ...NEW_PASSWORDS, algorithm: 'aes-256' });
      return qpdfDecryptQdf(await doc.save(), 'u2');
    },
    clear: false,
  },
  'decrypted on load, re-encrypted': {
    load: () => loadPdf(qpdfEncrypted(SOURCE), { password: 'user' }),
    write: async (doc) => {
      await doc.encrypt({ ...NEW_PASSWORDS, algorithm: 'rc4-128' });
      return qpdfDecryptQdf(await doc.save(), 'u2');
    },
    clear: false,
  },
};

describe('loadPdf then save: each /Info value no setter changed keeps its bytes', () => {
  beforeEach((ctx) => {
    requireQpdf(ctx);
  });

  it.each(Object.entries(ROUTES))('%s writes the loaded /Info unchanged', async (_name, route) => {
    const saved = await route.write(await route.load());
    expectQpdfClean(saved);
    expect(qpdfInfo(saved)).toEqual(qpdfInfo(SOURCE));
    if (route.clear) expect(await infoForms(saved)).toEqual(await infoForms(SOURCE));
  });

  it.each(Object.entries(ROUTES))(
    '%s after setTitle writes only /Title anew',
    async (_name, route) => {
      const doc = await route.load();
      doc.setTitle('Neu 日');
      expect(qpdfInfo(await route.write(doc))).toEqual({
        ...qpdfInfo(SOURCE),
        '/Title': 'u:Neu 日',
      });
    },
  );

  it('setting a key to the text its getter returned writes that text anew', async () => {
    const doc = await loadPdf(SOURCE);
    const title = doc.getTitle() ?? '';
    const keywords = doc.getKeywords() ?? '';
    doc.setTitle(title);
    doc.setKeywords(keywords);
    const saved = await doc.save();

    const info = await loadedInfo(saved);
    const written = (key: string): string | undefined => {
      const value = info.get(key);
      return value?.kind === 'string' ? value.toBytes().toHex() : undefined;
    };
    expect(written('/Title')).toBe(PdfString.fromText(title).toBytes().toHex());
    expect(written('/Keywords')).toBe(PdfString.fromText(keywords).toBytes().toHex());
    expect((await infoForms(saved))['/Keywords'], 'written anew in literal form').toBe(false);
    expect(qpdfText(qpdfInfo(saved)['/Title'])).toBe(title);
  });

  it('a loaded title saved again reads back as set, whatever its encoding', async () => {
    for (const title of ['日本 €', 'Preis €', 'Résumé', 'þÿab']) {
      const doc = createPdf();
      doc.addPage();
      doc.setTitle(title);
      const again = await (await loadPdf(await doc.save())).save();
      expect((await loadPdf(again)).getTitle(), title).toBe(title);
    }
  });
});

/** Each setter of a loaded document, the key it writes and the value qpdf reads after save. */
const SETTERS: readonly (readonly [string, (doc: PdfDocument) => void, string])[] = [
  ['/Author', (doc) => doc.setAuthor('Neu 日'), 'u:Neu 日'],
  ['/Subject', (doc) => doc.setSubject('Neu 日'), 'u:Neu 日'],
  ['/Keywords', (doc) => doc.setKeywords(['Neu', '日']), 'u:Neu, 日'],
  ['/Creator', (doc) => doc.setCreator('Neu 日'), 'u:Neu 日'],
  ['/Producer', (doc) => doc.setProducer('Neu 日'), 'u:Neu 日'],
  [
    '/CreationDate',
    (doc) => doc.setCreationDate(new Date(Date.UTC(2024, 0, 2, 3, 4, 5))),
    'u:D:20240102030405Z',
  ],
  [
    '/ModDate',
    (doc) => doc.setModDate(new Date(Date.UTC(2024, 0, 2, 3, 4, 5))),
    'u:D:20240102030405Z',
  ],
];

describe('loadPdf then a setter: only that key is written anew', () => {
  beforeEach((ctx) => {
    requireQpdf(ctx);
  });

  it.each(SETTERS)('save() after the setter of %s', async (key, set, written) => {
    const doc = await loadPdf(SOURCE);
    set(doc);
    expect(qpdfInfo(await doc.save())).toEqual({ ...qpdfInfo(SOURCE), [key]: written });
  });

  it('loadPdf with updateMetadata: true writes /ModDate anew and keeps the other keys', async () => {
    const { '/ModDate': savedModDate, ...saved } = qpdfInfo(
      await (await loadPdf(SOURCE, { updateMetadata: true })).save(),
    );
    const { '/ModDate': sourceModDate, ...source } = qpdfInfo(SOURCE);
    expect(saved).toEqual(source);
    expect(savedModDate).not.toBe(sourceModDate);
    expect(savedModDate).toMatch(/^u:D:\d{14}Z$/);
  });

  it('a loaded /ModDate that holds no date is kept, and getModDate() stays undefined', async () => {
    const doc = await loadPdf(infoPdf({ ModDate: '(no date)' }));
    expect(qpdfInfo(await doc.save())['/ModDate']).toBe('u:no date');
    expect(doc.getModDate()).toBeUndefined();
  });
});
