/**
 * G-QPDF and G-PDFJS: the writer matrix.
 *
 * Every row writes a PDF through one writer path of the library and hands it to `qpdf --check`
 * (expectQpdfClean); most rows also ask pdf.js for the text or the page count (pdfjsText,
 * expectPdfjsText, withPdfjs). Rows write with `compress: false` unless the row says otherwise,
 * so pdf.js reads the content streams as the writer emitted them. A path that fails an outside
 * reader today is a knownDefect() marker keyed to its ledger id; the marker asserts the reader's
 * success condition, so it turns red the day the fix lands. qpdf comes from `QPDF`, then `PATH`; each test skips with a reason
 * where qpdf is absent locally and fails when `CI` is set.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  addCounterSignature,
  appendIncrementalUpdate,
  batchMerge,
  copyPages,
  createPdf,
  delinearizePdf,
  enforcePdfA,
  enforcePdfAFull,
  enforcePdfX,
  flattenTransparency,
  jsxh,
  linearizePdf,
  loadPdf,
  mergePdfs,
  optimizeIncrementalSave,
  prepareForSigning,
  renderJsxToPdf,
  saveDocumentIncremental,
  saveIncrementalWithSignaturePreservation,
  signPdf,
  splitPdf,
  stripProhibitedFeatures,
} from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import { uncheckedOutputs } from '../helpers/oracle/outputs.js';
import { expectPdfjsText, pdfjsImages, pdfjsText, withPdfjs } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';
import { generateTestCert } from '../helpers/signature-trust-fixtures.js';

const IMAGES = join(import.meta.dirname, '../fixtures/images');
const latin1 = new TextDecoder('latin1');
const PLAIN = { compress: false } as const;
/** Twenty lines: a content stream long enough that a default save compresses it. */
const LINES = Array.from({ length: 20 }, (_, i) => `Matrix line ${i + 1}`);

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A one-page document with `lines` drawn in the default font, one per line. */
function textDoc(lines: readonly string[]): PdfDocument {
  const doc = createPdf();
  const page = doc.addPage();
  lines.forEach((line, i) => page.drawText(line, { x: 50, y: 750 - i * 16, size: 12 }));
  return doc;
}

const textPdf = (lines: readonly string[]): Promise<Uint8Array> => textDoc(lines).save(PLAIN);

const pageCount = (bytes: Uint8Array): Promise<number> =>
  withPdfjs(bytes, async (doc) => doc.numPages);

/** A minimal one-page PDF written by hand, with a correct cross-reference table. */
function handWrittenPdf(text: string, startxrefShift = 0): Uint8Array {
  const content = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
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
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  out += `startxref\n${xrefAt + startxrefShift}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

describe('oracle self-test', () => {
  test('a hand-written valid PDF passes qpdf and pdf.js', async () => {
    const bytes = handWrittenPdf('Oracle self-test');
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Oracle self-test']);
  });

  test('the same file with its startxref moved fails expectQpdfClean', () => {
    expect(() => expectQpdfClean(handWrittenPdf('Oracle self-test', 7))).toThrow(
      /^qpdf --check exit [23]: .*(WARNING|ERROR)/,
    );
  });

  test('expectPdfjsText fails on text the page does not show', async () => {
    await expect(
      expectPdfjsText(handWrittenPdf('Oracle self-test'), ['Other text']),
    ).rejects.toThrow(/to deeply equal/);
  });

  test('the setup guard records a save() output until expectQpdfClean checks it', async () => {
    const bytes = await textPdf(['Guarded output']);
    expect(uncheckedOutputs()).toEqual(['save()']);
    expectQpdfClean(bytes);
    expect(uncheckedOutputs()).toEqual([]);
  });
});

describe('text in a standard 14 font', () => {
  test('one line: qpdf clean, pdf.js text equal', async () => {
    const bytes = await textPdf(['Matrix text line']);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Matrix text line']);
  });

  test('twenty lines: qpdf clean, pdf.js text equal', async () => {
    const bytes = await textPdf(LINES);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, [LINES.join(' ')]);
  });

  test('twenty lines, default save (a compressed content stream): qpdf clean, pdf.js text equal', async () => {
    const bytes = await textDoc(LINES).save();
    expect(latin1.decode(bytes)).toContain('/FlateDecode');
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, [LINES.join(' ')]);
  });
});

describe('images', () => {
  /** A one-page document that draws the PNG fixture `file` (sample.png has no alpha channel). */
  async function pngDoc(file = 'sample.png'): Promise<PdfDocument> {
    const doc = createPdf();
    const image = await doc.embedPng(new Uint8Array(readFileSync(join(IMAGES, file))));
    doc.addPage().drawImage(image, { x: 50, y: 500, width: 50, height: 50 });
    return doc;
  }

  test('PNG: qpdf clean, pdf.js opens one page', async () => {
    const bytes = await (await pngDoc()).save(PLAIN);
    expectQpdfClean(bytes);
    expect(await pageCount(bytes)).toBe(1);
  });

  test('PNG, default save: the compressed page content stream passes qpdf --check', async () => {
    expectQpdfClean(await (await pngDoc()).save());
  });

  // An alpha channel sends the image and its soft mask through the PNG embedder's own
  // compression; with compress: false no other stream of the file is compressed. When qpdf
  // fails, the streams it names must be the image streams.
  test('PNG with an alpha channel, compress: false: the image and soft mask streams pass qpdf --check', async () => {
    const bytes = await (await pngDoc('sample-rgba.png')).save(PLAIN);
    try {
      expectQpdfClean(bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failing = new Set(
        Array.from(message.matchAll(/error decoding stream data for object (\d+) 0/g), (m) =>
          Number(m[1]),
        ),
      );
      expect(failing.size).toBeGreaterThan(0);
      for (const objectNumber of failing) {
        expect(streamDictionary(bytes, objectNumber)).toMatch(/\/Subtype\s*\/Image\b/);
      }
      throw error;
    }
  });

  // pillow-16x16.jpg comes from an outside encoder (tests/fixtures/images/README.md).
  test('JPEG: qpdf clean, pdf.js decodes the 16x16 image, the stream holds the file bytes unchanged', async () => {
    const jpeg = new Uint8Array(readFileSync(join(IMAGES, 'pillow-16x16.jpg')));
    const doc = createPdf();
    const image = await doc.embedJpeg(jpeg);
    doc.addPage().drawImage(image, { x: 50, y: 500, width: 50, height: 50 });
    const bytes = await doc.save(PLAIN);
    expectQpdfClean(bytes);
    expect(await pageCount(bytes)).toBe(1);
    expect(await pdfjsImages(bytes)).toEqual([
      [{ width: 16, height: 16, dataLength: 16 * 16 * 3 }],
    ]);
    const text = latin1.decode(bytes);
    const dict = /<<[^>]*\/Filter \/DCTDecode[^>]*>>\s*stream\r?\n/.exec(text);
    expect(dict).not.toBeNull();
    const start = (dict?.index ?? 0) + (dict?.[0].length ?? 0);
    expect(bytes.subarray(start, start + jpeg.length)).toEqual(jpeg);
  });
});

/** The dictionary of stream object `objectNumber` (generation 0) of a file without object streams. */
function streamDictionary(bytes: Uint8Array, objectNumber: number): string {
  const match = new RegExp(
    `(?:^|\\s)${objectNumber} 0 obj\\s*(<<[\\s\\S]*?>>)\\s*stream\\r?\\n`,
  ).exec(latin1.decode(bytes));
  if (match?.[1] === undefined) throw new Error(`no stream object ${objectNumber} 0 in the file`);
  return match[1];
}

describe('document features', () => {
  const XMP =
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format>' +
    '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';

  const features: readonly (readonly [string, (doc: PdfDocument) => void])[] = [
    [
      'a text annotation',
      (doc) => {
        doc.getPage(0).addAnnotation('Text', { rect: [50, 50, 70, 70], contents: 'Note' });
      },
    ],
    ['an outline item', (doc) => void doc.addOutline('Chapter', 0)],
    [
      'an optional content layer',
      (doc) => {
        const page = doc.getPage(0);
        page.beginLayer(doc.addLayer('Layer A'));
        page.drawText('In a layer', { x: 50, y: 600, size: 12 });
        page.endLayer();
      },
    ],
    [
      'an attachment',
      (doc) =>
        doc.attachFile('note.txt', new TextEncoder().encode('attached'), 'text/plain', {
          description: 'A note',
        }),
    ],
    ['XMP metadata', (doc) => doc.setXmpMetadata(XMP)],
    [
      'a structure tree with a marked paragraph',
      (doc) => {
        const tree = doc.createStructureTree();
        const paragraph = tree.root.addChild('P');
        doc.getPage(0).markContent('P', tree.assignMcid(paragraph, 0));
      },
    ],
  ];

  test.for(features)('%s: qpdf clean, pdf.js text equal', async ([, add]) => {
    const doc = textDoc(['Feature page']);
    add(doc);
    const bytes = await doc.save(PLAIN);
    expectQpdfClean(bytes);
    expect((await pdfjsText(bytes))[0]).toContain('Feature page');
  });

  async function fieldPdf(): Promise<Uint8Array> {
    const doc = textDoc(['Form page']);
    doc.getForm().createTextField('name', 0, [50, 600, 250, 625]).setText('Field value');
    return doc.save(PLAIN);
  }

  test('a text field: qpdf clean, pdf.js text equal', async () => {
    const bytes = await fieldPdf();
    expectQpdfClean(bytes);
    expect((await pdfjsText(bytes))[0]).toContain('Form page');
  });

  knownDefect(
    defectKey('forms-35', '0.41.4'),
    'a text field: pdf.js getFieldObjects() holds the field',
    { failsWith: /^AssertionError: pdf\.js getFieldObjects\(\) size: expected \+0 to be 1/ },
    async () => {
      const bytes = await fieldPdf();
      expectQpdfClean(bytes);
      const fields = await withPdfjs(bytes, (pdf) => pdf.getFieldObjects());
      expect(fields?.size ?? 0, 'pdf.js getFieldObjects() size').toBe(1);
    },
  );
});

describe('object streams', () => {
  test('objectStreamThreshold: 1: qpdf clean, pdf.js text equal', async () => {
    const bytes = await textDoc(['Object streams']).save({ ...PLAIN, objectStreamThreshold: 1 });
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Object streams']);
  });

  test('objectStreamThreshold: 1 with a default save passes qpdf --check', async () => {
    expectQpdfClean(await textDoc(['Object streams']).save({ objectStreamThreshold: 1 }));
  });
});

describe('saveAsStream', () => {
  const EPOCH = new Date('2026-01-01T00:00:00Z');

  /** A document with fixed dates, so two built alike give comparable bytes. */
  function datedDoc(): PdfDocument {
    const doc = textDoc(['Streamed text']);
    doc.setCreationDate(EPOCH);
    doc.setModDate(EPOCH);
    return doc;
  }

  const streamBytes = async (doc: PdfDocument): Promise<Uint8Array> =>
    new Uint8Array(await new Response(doc.saveAsStream(PLAIN)).arrayBuffer());

  test('stream bytes equal the save() bytes of a document built alike; qpdf clean, pdf.js text equal', async () => {
    const streamed = await streamBytes(datedDoc());
    const saved = await datedDoc().save(PLAIN);
    expect(streamed).toEqual(saved);
    expectQpdfClean(streamed);
    await expectPdfjsText(streamed, ['Streamed text']);
  });

  knownDefect(
    defectKey('core-document-08', '0.41.2'),
    'saveAsStream() after save() of one document gives the save() bytes again',
    {
      failsWith:
        /^AssertionError: saveAsStream\(\) bytes after save\(\): expected Uint8Array\[.*\] to deeply equal Uint8Array\[/,
    },
    async () => {
      const doc = datedDoc();
      const saved = await doc.save(PLAIN);
      expectQpdfClean(saved);
      const streamed = await streamBytes(doc);
      expectQpdfClean(streamed);
      expect(streamed, 'saveAsStream() bytes after save()').toEqual(saved);
    },
  );
});

describe('load and save', () => {
  test('a loaded own output saves again: qpdf clean, pdf.js text equal', async () => {
    const original = await textPdf(['Loaded text']);
    expectQpdfClean(original);
    const bytes = await (await loadPdf(original)).save(PLAIN);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Loaded text']);
  });
});

describe('merge, split and copy', () => {
  async function loadedPair(): Promise<[PdfDocument, PdfDocument]> {
    const a = await textPdf(['Merge page A']);
    const b = await textPdf(['Merge page B']);
    expectQpdfClean(a);
    expectQpdfClean(b);
    return [await loadPdf(a), await loadPdf(b)];
  }

  test('mergePdfs: qpdf clean, two pages', async () => {
    const bytes = await (await mergePdfs(await loadedPair())).save(PLAIN);
    expectQpdfClean(bytes);
    expect(await pageCount(bytes)).toBe(2);
  });

  knownDefect(
    defectKey('core-document-10', '0.41.3'),
    'mergePdfs of two loaded documents: pdf.js shows the text of both pages',
    { failsWith: /^AssertionError: expected \[ '', '' \] to deeply equal/ },
    async () => {
      const bytes = await (await mergePdfs(await loadedPair())).save(PLAIN);
      expectQpdfClean(bytes);
      await expectPdfjsText(bytes, ['Merge page A', 'Merge page B']);
    },
  );

  test('splitPdf: each part qpdf clean, one page each', async () => {
    const two = textDoc(['Split page 1']);
    two.addPage().drawText('Split page 2', { x: 50, y: 750, size: 12 });
    const parts = await splitPdf(two, [
      [0, 0],
      [1, 1],
    ]);
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      const bytes = await part.save(PLAIN);
      expectQpdfClean(bytes);
      expect(await pageCount(bytes)).toBe(1);
    }
  });

  test('copyPages: qpdf clean, two pages', async () => {
    const [source] = await loadedPair();
    const target = textDoc(['Copy target']);
    expect(copyPages(source, target, [0])).toHaveLength(1);
    const bytes = await target.save(PLAIN);
    expectQpdfClean(bytes);
    expect(await pageCount(bytes)).toBe(2);
  });

  test('batchMerge: qpdf clean, two pages', async () => {
    const inputs = [await textPdf(['Batch A']), await textPdf(['Batch B'])];
    for (const input of inputs) expectQpdfClean(input);
    const bytes = await batchMerge(inputs);
    expectQpdfClean(bytes);
    expect(await pageCount(bytes)).toBe(2);
  });
});

describe('renderJsxToPdf', () => {
  test('qpdf clean, pdf.js text equal', async () => {
    const bytes = await renderJsxToPdf(
      jsxh('document', null, jsxh('page', null, jsxh('text', null, 'Rendered text'))),
    );
    expectQpdfClean(bytes);
    expect((await pdfjsText(bytes))[0]).toContain('Rendered text');
  });
});

describe('linearization', () => {
  knownDefect(
    defectKey('core-graphics-38', '0.42.6'),
    'linearizePdf output passes qpdf --check',
    { failsWith: /^QpdfError: qpdf --check exit 2: .*read_bits/ },
    async () => {
      expectQpdfClean(await linearizePdf(await textPdf(['Linearized text'])));
    },
  );

  test('delinearizePdf of a linearized own output: qpdf clean, pdf.js text equal', async () => {
    const plain = await textPdf(['Delinearized text']);
    expectQpdfClean(plain);
    const bytes = await delinearizePdf(await linearizePdf(plain));
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Delinearized text']);
  });
});

describe('compliance transforms', () => {
  let plain: Uint8Array;
  beforeAll(async () => {
    plain = await textPdf(['Compliance text']);
  });

  test('the input is qpdf clean', () => {
    expectQpdfClean(plain);
  });

  // pdfA.ts splices /Metadata into the catalog and appends an object after the end of the file
  // without updating the cross-reference table; no ledger id names this file yet.
  knownDefect(
    defectKey('oracle-gates-R01', '0.41.1'),
    'enforcePdfA output passes qpdf --check',
    { failsWith: /^QpdfError: qpdf --check exit 3: .*xref not found/ },
    async () => {
      expectQpdfClean(await enforcePdfA(plain, '2b'));
    },
  );

  knownDefect(
    defectKey(['compliance-07', 'tests-unit-compliance-03'], '0.41.1'),
    'enforcePdfAFull output passes qpdf --check',
    { failsWith: /^QpdfError: qpdf --check exit 3: .*xref not found/ },
    async () => {
      expectQpdfClean((await enforcePdfAFull(plain, '2b')).bytes);
    },
  );

  knownDefect(
    defectKey('compliance-03', '0.41.1'),
    'enforcePdfX output passes qpdf --check',
    { failsWith: /^QpdfError: qpdf --check exit 3: .*xref not found/ },
    () => {
      expectQpdfClean(enforcePdfX(plain, { level: 'X-4', outputIntent: { condition: 'FOGRA39' } }));
    },
  );

  // The UTF-8 round trip turns the four bytes of the binary comment line after the header into
  // four U+FFFD (twelve bytes), so every later cross-reference offset is off by eight.
  knownDefect(
    defectKey(['compliance-04', 'tests-unit-compliance-01'], '0.41.1'),
    'flattenTransparency output passes qpdf --check',
    { failsWith: /^QpdfError: qpdf --check exit 3: .*xref not found/ },
    () => {
      const bytes = flattenTransparency(plain);
      expect(bytes.length - plain.length).toBe(8);
      expectQpdfClean(bytes);
    },
  );

  test('stripProhibitedFeatures with nothing to strip: qpdf clean, pdf.js text equal', async () => {
    const { bytes, stripped } = stripProhibitedFeatures(plain);
    expect(stripped).toEqual([]);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Compliance text']);
  });
});

describe('signatures', () => {
  let signer: { certificate: Uint8Array; privateKey: Uint8Array };
  let plain: Uint8Array;
  beforeAll(async () => {
    const cert = await generateTestCert('Matrix Signer');
    signer = { certificate: cert.certificate, privateKey: cert.privateKey };
    plain = await textPdf(['Signed text']);
  });

  test('signPdf: qpdf clean, pdf.js text equal', async () => {
    expectQpdfClean(plain);
    const bytes = await signPdf(plain, 'Signature1', signer);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Signed text']);
  });

  test('PdfDocument.sign: qpdf clean', async () => {
    expectQpdfClean(await textDoc(['Signed text']).sign('Signature1', signer));
  });

  test('prepareForSigning: qpdf clean', () => {
    expectQpdfClean(prepareForSigning(plain, 'Signature1').preparedPdf);
  });

  test('addCounterSignature: qpdf clean', async () => {
    const signed = await signPdf(plain, 'Signature1', signer);
    expectQpdfClean(await addCounterSignature(signed, 0, signer));
  });
});

describe('incremental updates', () => {
  let plain: Uint8Array;
  beforeAll(async () => {
    plain = await textPdf(['Incremental text']);
  });

  test('saveDocumentIncremental: qpdf clean, pdf.js shows the added page', async () => {
    expectQpdfClean(plain);
    const doc = await loadPdf(plain);
    doc.addPage().drawText('Added page', { x: 50, y: 750, size: 12 });
    const { bytes } = await saveDocumentIncremental(plain, doc, PLAIN);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Incremental text', 'Added page']);
  });

  /** The /Size of the input file: the next free object number. */
  const nextObjectNumber = (): number => Number(/\/Size (\d+)/.exec(latin1.decode(plain))?.[1]);

  test('appendIncrementalUpdate of the next free object number: qpdf clean', () => {
    const bytes = appendIncrementalUpdate(plain, [
      {
        objectNumber: nextObjectNumber(),
        generationNumber: 0,
        data: new TextEncoder().encode('(appended)'),
      },
    ]);
    expectQpdfClean(bytes);
  });

  test('saveIncrementalWithSignaturePreservation: qpdf clean, pdf.js text equal', async () => {
    const modifiedDoc = await loadPdf(plain);
    modifiedDoc.setTitle('Modified');
    const modified = await modifiedDoc.save(PLAIN);
    expectQpdfClean(modified);
    const bytes = saveIncrementalWithSignaturePreservation(plain, modified);
    expectQpdfClean(bytes);
    await expectPdfjsText(bytes, ['Incremental text']);
  });

  test('optimizeIncrementalSave of an ASCII object at the next free object number: qpdf clean', () => {
    const change = {
      objectNumber: nextObjectNumber(),
      generationNumber: 0,
      newContent: new TextEncoder().encode('(changed)'),
    };
    expectQpdfClean(optimizeIncrementalSave(plain, [change]));
  });

  knownDefect(
    defectKey(['signature-cms-53', 'tests-unit-signature-a-03'], '0.41.1'),
    'optimizeIncrementalSave of a binary stream object passes qpdf --check',
    { failsWith: /^QpdfError: qpdf --check exit 3: .*expected endstream/ },
    () => {
      const enc = new TextEncoder();
      const newContent = new Uint8Array([
        ...enc.encode('<< /Length 4 >>\nstream\n'),
        0x80,
        0xe9,
        0xff,
        0xfe,
        ...enc.encode('\nendstream'),
      ]);
      expectQpdfClean(
        optimizeIncrementalSave(plain, [
          { objectNumber: nextObjectNumber(), generationNumber: 0, newContent },
        ]),
      );
    },
  );
});
