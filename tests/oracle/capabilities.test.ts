/**
 * G-CAP evidence: tests for the capability rows of docs/capabilities.json that no other oracle
 * test tags.
 *
 * Each test carries the ids it is evidence for in `meta.capability`; scripts/dev/capability-gate.ts
 * reads them from the Vitest JSON report. A test about PDF output writes through the root entry
 * with `compress: false` and judges the bytes with `qpdf --check` (expectQpdfClean) and pdf.js;
 * a test about packaging, CI or a non-PDF return value (the `behaviour` grade) asserts the claim
 * directly. A claim the outside reader shows false is a knownDefect() marker keyed to its ledger
 * id (it carries no capability tag: a marker is not evidence for a row). The header and footer,
 * watermark, save(), saveAsBlob() and saveAsBase64() claims are also checked on output written
 * with the default save options (`compress: true`), whose /FlateDecode streams qpdf and pdf.js
 * read the same way. qpdf comes from `QPDF`,
 * then `PATH`; each test skips with a reason where qpdf is absent locally and fails when `CI` is
 * set.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  applyHeaderFooter,
  checkCertificateStatus,
  createPdf,
  createSandbox,
  detectImageFormat,
  downloadCrl,
  loadPdf,
  pdfResponse,
  processBatch,
  saveIncrementalWithSignaturePreservation,
  ScriptExecutionDisabledError,
  signPdf,
  tagFigure,
  tagHeading,
  tagParagraph,
  verifyOfflineRevocation,
  verifySignatures,
} from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { defectKey, knownDefect } from '../helpers/known-defect.js';
import { pdfjsText, withPdfjs } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';
import { generateTestCert } from '../helpers/signature-trust-fixtures.js';

const ROOT = join(import.meta.dirname, '../..');
const IMAGES = join(ROOT, 'tests/fixtures/images');
const PLAIN = { compress: false } as const;
const png = (): Uint8Array => new Uint8Array(readFileSync(join(IMAGES, 'sample.png')));

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** A one-page document with `text` drawn in the default font. */
function textDoc(text: string): PdfDocument {
  const doc = createPdf();
  doc.addPage().drawText(text, { x: 50, y: 750, size: 12 });
  return doc;
}

/**
 * A one-page document with twenty lines of text: a content stream long enough that the default
 * save compresses it (the writer keeps the deflated data only when it is shorter).
 */
function longTextDoc(text: string): PdfDocument {
  const doc = createPdf();
  const page = doc.addPage();
  for (let i = 0; i < 20; i++) page.drawText(`${text} ${i}`, { x: 50, y: 750 - 20 * i, size: 12 });
  return doc;
}

/** Saves with `compress: false`, checks the bytes with qpdf and returns them. */
async function cleanSave(doc: PdfDocument): Promise<Uint8Array> {
  const bytes = await doc.save(PLAIN);
  expectQpdfClean(bytes);
  return bytes;
}

describe('writer rows judged by qpdf and pdf.js', () => {
  test(
    'text, shapes, an SVG path and a PNG image on one page',
    { meta: { capability: ['cap-feat-pages'] } },
    async () => {
      const doc = createPdf();
      const page = doc.addPage();
      page.drawText('Shapes page', { x: 50, y: 750, size: 12 });
      page.drawRectangle({ x: 50, y: 600, width: 100, height: 50 });
      page.drawCircle({ x: 250, y: 625, size: 25 });
      page.drawLine({ start: { x: 50, y: 580 }, end: { x: 300, y: 580 } });
      page.drawSvgPath('M 0 0 L 50 0 L 25 40 Z', { x: 350, y: 600 });
      page.drawImage(await doc.embedPng(png()), { x: 50, y: 450, width: 50, height: 50 });
      const bytes = await cleanSave(doc);
      expect(await pdfjsText(bytes)).toEqual(['Shapes page']);
      const ops = await withPdfjs(bytes, async (pdf) => {
        const list = await (await pdf.getPage(1)).getOperatorList();
        return list.fnArray.length;
      });
      expect(ops).toBeGreaterThan(10);
    },
  );

  test(
    'an outline item: pdf.js getOutline() returns its title',
    { meta: { capability: ['cap-outlines'] } },
    async () => {
      const doc = textDoc('Outline page');
      doc.addOutline('Chapter 1', 0);
      const bytes = await cleanSave(doc);
      const titles = await withPdfjs(bytes, async (pdf) =>
        ((await pdf.getOutline()) ?? []).map((item) => item.title),
      );
      expect(titles).toEqual(['Chapter 1']);
    },
  );

  /** A page with text drawn between beginLayer() and endLayer() of a layer named 'Layer A'. */
  function layerDoc(): PdfDocument {
    const doc = textDoc('Layer page');
    const page = doc.getPage(0);
    page.beginLayer(doc.addLayer('Layer A'));
    page.drawText('In a layer', { x: 50, y: 600, size: 12 });
    page.endLayer();
    return doc;
  }

  // Not evidence for the layer rows: the group is listed, but the next marker shows the content
  // is not bound to it.
  test('an optional content layer: pdf.js lists the group and the page text', async () => {
    const bytes = await cleanSave(layerDoc());
    const names = await withPdfjs(bytes, async (pdf) => {
      const config = await pdf.getOptionalContentConfig();
      return [...config].map(([, group]) => (group as { name: string }).name);
    });
    expect(names).toEqual(['Layer A']);
    expect((await pdfjsText(bytes))[0]).toContain('In a layer');
  });

  knownDefect(
    defectKey('accessibility-metadata-40', '0.42.1'),
    'an optional content layer: the page /Properties binds the BDC name to the listed OCG',
    {
      failsWith:
        /^AssertionError: the page \/Resources \/Properties binds \/Layer_A: expected undefined to be defined/,
    },
    async () => {
      const text = new TextDecoder('latin1').decode(await cleanSave(layerDoc()));
      const name = /\/OC\s*\/(\S+)\s+BDC/.exec(text)?.[1];
      expect(name, 'the content opens an /OC marked-content sequence').toBeDefined();
      const bound = new RegExp(
        `/Properties\\s*<<[^>]*/${RegExp.escape(name ?? '')}\\s+(\\d+) 0 R`,
      ).exec(text)?.[1];
      expect(bound, `the page /Resources /Properties binds /${name}`).toBeDefined();
      const ocgs = [...(/\/OCGs\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '').matchAll(/(\d+) 0 R/g)].map(
        (m) => m[1],
      );
      expect(ocgs, '/OCProperties /OCGs').toContain(bound);
    },
  );

  test(
    'an attached file: pdf.js getAttachments() returns its name and bytes',
    { meta: { capability: ['cap-attachments-watermarks'] } },
    async () => {
      const doc = textDoc('Attachment page');
      doc.attachFile('note.txt', new TextEncoder().encode('attached'), 'text/plain');
      const bytes = await cleanSave(doc);
      // pdfjs-dist 6.5 returns the metadata from getAttachments() and the bytes, keyed by the
      // same id, from getAttachmentContent().
      const files = await withPdfjs(bytes, async (pdf) => {
        const out: [string, string][] = [];
        for (const [id, a] of (await pdf.getAttachments()) ?? new Map()) {
          const content = a.content ?? (await pdf.getAttachmentContent(id));
          out.push([a.filename, new TextDecoder().decode(content ?? new Uint8Array())]);
        }
        return out;
      });
      expect(files).toEqual([['note.txt', 'attached']]);
    },
  );

  test(
    'a text watermark: pdf.js extracts the watermark text',
    { meta: { capability: ['cap-attachments-watermarks', 'cap-watermarks'] } },
    async () => {
      const doc = textDoc('Watermark page');
      doc.addWatermark({ text: 'DRAFT' });
      const bytes = await cleanSave(doc);
      const text = (await pdfjsText(bytes))[0] ?? '';
      expect(text).toContain('Watermark page');
      expect(text).toContain('DRAFT');
    },
  );

  test(
    'header and footer templates: pdf.js extracts the title, the date and the page numbers',
    { meta: { capability: ['cap-header-footer'] } },
    async () => {
      const doc = textDoc('Body one');
      doc.addPage().drawText('Body two', { x: 50, y: 750, size: 12 });
      doc.setTitle('Report');
      applyHeaderFooter(doc, {
        header: [{ text: '{title} {date}', position: 'left' }],
        footer: [{ text: 'Page {page} of {pages}', position: 'center' }],
        dateFormat: 'YYYY',
      });
      const pages = await pdfjsText(await cleanSave(doc));
      expect(pages).toHaveLength(2);
      // The year of the save, read after it: a save across New Year's midnight may be one off.
      expect(pages[0]).toMatch(
        new RegExp(`Report (${new Date().getFullYear()}|${new Date().getFullYear() - 1})`),
      );
      expect(pages[0]).toContain('Page 1 of 2');
      expect(pages[1]).toContain('Page 2 of 2');
    },
  );

  test(
    'document language and title: pdf.js reads /Lang, the Info title and DisplayDocTitle',
    { meta: { capability: ['cap-a11y-language', 'cap-a11y-title'] } },
    async () => {
      const doc = textDoc('Metadata page');
      doc.setLanguage('en-US');
      doc.setTitle('Accessible title', { showInWindowTitleBar: true });
      const bytes = await cleanSave(doc);
      const { info, prefs } = await withPdfjs(bytes, async (pdf) => ({
        info: (await pdf.getMetadata()).info as Record<string, unknown>,
        prefs: await pdf.getViewerPreferences(),
      }));
      expect(info['Language']).toBe('en-US');
      expect(info['Title']).toBe('Accessible title');
      expect(prefs?.get('DisplayDocTitle')).toBe(true);
    },
  );

  // The Info /Title is a literal string written as one Latin-1 byte per character: é is 0xE9,
  // which PDFDocEncoding decodes to the same character, so pdf.js reads the title as set.
  test('a non-ASCII title: pdf.js reads the Info title as set', async () => {
    const doc = textDoc('Title page');
    doc.setTitle('Résumé');
    const info = await withPdfjs(
      await cleanSave(doc),
      async (pdf) => (await pdf.getMetadata()).info as Record<string, unknown>,
    );
    expect(info['Title']).toBe('Résumé');
  });

  // loadPdf does not read /Lang or /ViewerPreferences, so a full save of the loaded document
  // writes neither.
  knownDefect(
    defectKey('tests-unit-accessibility-M01', '0.42.2'),
    'a loaded PDF saved again keeps its /Lang and DisplayDocTitle',
    { failsWith: /^AssertionError: expected null to be 'en'/ },
    async () => {
      const doc = textDoc('Reloaded page');
      doc.setLanguage('en');
      doc.setTitle('Kept title', { showInWindowTitleBar: true });
      const loaded = await loadPdf(await cleanSave(doc));
      const { info, prefs } = await withPdfjs(await cleanSave(loaded), async (pdf) => ({
        info: (await pdf.getMetadata()).info as Record<string, unknown>,
        prefs: await pdf.getViewerPreferences(),
      }));
      expect(info['Language'] ?? null).toBe('en');
      expect(prefs?.get('DisplayDocTitle')).toBe(true);
    },
  );

  test(
    'header, footer and watermark with default options and a default save(): pdf.js extracts their text',
    { meta: { capability: ['cap-header-footer', 'cap-watermarks'] } },
    async () => {
      const doc = textDoc('Body one');
      doc.addPage().drawText('Body two', { x: 50, y: 750, size: 12 });
      doc.setTitle('Report');
      // {date} in the default format (YYYY-MM-DD, local time), read just before and just after
      // the call: a call across midnight may write either date.
      const ymd = (d: Date): string =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const before = ymd(new Date());
      applyHeaderFooter(doc, {
        header: [{ text: '{title} {date}', position: 'left' }],
        footer: [{ text: 'Page {page} of {pages}', position: 'center' }],
      });
      const after = ymd(new Date());
      doc.addWatermark({ text: 'DRAFT' });
      const bytes = await doc.save();
      expect(new TextDecoder('latin1').decode(bytes)).toContain('/FlateDecode');
      expectQpdfClean(bytes);
      const pages = await pdfjsText(bytes);
      expect(pages).toHaveLength(2);
      expect([`Report ${before}`, `Report ${after}`].some((h) => pages[0]?.includes(h))).toBe(true);
      expect(pages[0]).toContain('Page 1 of 2');
      expect(pages[0]).toContain('DRAFT');
      expect(pages[1]).toContain('Page 2 of 2');
    },
  );

  // The page gets no /StructParents and the ParentTree names a placeholder element, so pdf.js
  // finds no structure for the page; the rows that claim tags and alt text are qualified.
  knownDefect(
    defectKey('accessibility-metadata-01', '0.46.0'),
    'a heading, a paragraph and a figure with alt text: pdf.js getStructTree() shows them in order',
    {
      failsWith:
        /^AssertionError: expected \[\] to deeply equal \[ 'H1', 'P', 'Figure:A small image' \]/,
    },
    async () => {
      const doc = createPdf();
      const page = doc.addPage();
      const tree = doc.createStructureTree();
      const heading = tagHeading(tree, null, 1);
      const paragraph = tagParagraph(tree, null);
      const figure = tagFigure(tree, null, 'A small image');
      page.beginMarkedContent('H1', tree.assignMcid(heading, 0));
      page.drawText('Heading text', { x: 50, y: 750, size: 18 });
      page.endMarkedContentSequence();
      page.beginMarkedContent('P', tree.assignMcid(paragraph, 0));
      page.drawText('Paragraph text', { x: 50, y: 700, size: 12 });
      page.endMarkedContentSequence();
      page.beginMarkedContent('Figure', tree.assignMcid(figure, 0));
      page.drawImage(await doc.embedPng(png()), { x: 50, y: 600, width: 50, height: 50 });
      page.endMarkedContentSequence();
      const bytes = await cleanSave(doc);
      const nodes = await withPdfjs(bytes, async (pdf) => {
        const root = await (await pdf.getPage(1)).getStructTree();
        const out: string[] = [];
        const walk = (node: { role?: string; alt?: string; children?: unknown[] }): void => {
          if (node.role !== undefined && node.role !== 'Root') {
            out.push(node.alt === undefined ? node.role : `${node.role}:${node.alt}`);
          }
          for (const child of node.children ?? []) walk(child as typeof node);
        };
        if (root !== null) walk(root);
        return out;
      });
      expect(nodes).toEqual(['H1', 'P', 'Figure:A small image']);
    },
  );

  test(
    'detectImageFormat names PNG and JPEG; embedImage detects PNG from its bytes and embeds it',
    { meta: { capability: ['cap-image-autodetect'] } },
    async () => {
      expect(detectImageFormat(png())).toBe('png');
      expect(detectImageFormat(new Uint8Array(readFileSync(join(IMAGES, 'sample.jpg'))))).toBe(
        'jpeg',
      );
      const doc = createPdf();
      const image = await doc.embedImage(png());
      doc.addPage().drawImage(image, { x: 50, y: 500, width: 50, height: 50 });
      const bytes = await cleanSave(doc);
      const paints = await withPdfjs(bytes, async (pdf) => {
        const list = await (await pdf.getPage(1)).getOperatorList();
        // OPS.paintImageXObject is 85 in pdf.js.
        return list.fnArray.filter((op) => op === 85).length;
      });
      expect(paints).toBe(1);
    },
  );
});

describe('save methods (positive path)', () => {
  test(
    'save() resolves to a Uint8Array that qpdf and pdf.js read',
    { meta: { capability: ['cap-save'] } },
    async () => {
      const bytes = await textDoc('Saved page').save(PLAIN);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expectQpdfClean(bytes);
      expect(await pdfjsText(bytes)).toEqual(['Saved page']);
    },
  );

  test(
    'saveAsStream() returns a ReadableStream whose bytes qpdf and pdf.js read',
    { meta: { capability: ['cap-save-stream'] } },
    async () => {
      const stream = textDoc('Streamed page').saveAsStream(PLAIN);
      expect(stream).toBeInstanceOf(ReadableStream);
      const bytes = await new Response(stream).bytes();
      expectQpdfClean(bytes);
      expect(await pdfjsText(bytes)).toEqual(['Streamed page']);
    },
  );

  test(
    'saveAsBlob() and saveAsBase64({ dataUri: true }) carry a readable PDF',
    { meta: { capability: ['cap-save-blob', 'cap-save-base64'] } },
    async () => {
      const blob = await textDoc('Blob page').saveAsBlob(PLAIN);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      const fromBlob = await blob.bytes();
      expectQpdfClean(fromBlob);
      expect(await pdfjsText(fromBlob)).toEqual(['Blob page']);

      const uri = await textDoc('Base64 page').saveAsBase64({ ...PLAIN, dataUri: true });
      expect(uri.startsWith('data:application/pdf;base64,')).toBe(true);
      const fromUri = Uint8Array.fromBase64(uri.slice('data:application/pdf;base64,'.length));
      expectQpdfClean(fromUri);
      expect(await pdfjsText(fromUri)).toEqual(['Base64 page']);
    },
  );

  /**
   * Checks that the bytes hold a /FlateDecode stream and that pdf.js reads the twenty lines
   * longTextDoc(text) draws on its one page.
   */
  async function expectLongText(bytes: Uint8Array, text: string): Promise<void> {
    expect(new TextDecoder('latin1').decode(bytes)).toContain('/FlateDecode');
    const pages = await pdfjsText(bytes);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain(`${text} 0`);
    expect(pages[0]).toContain(`${text} 19`);
  }

  // The default is compress: true: the long text compresses, so qpdf and pdf.js have
  // FlateDecode streams to inflate.
  test(
    'save() with default options: qpdf --check and pdf.js read the FlateDecode streams',
    { meta: { capability: ['cap-save'] } },
    async () => {
      const bytes = await longTextDoc('Default save').save();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expectQpdfClean(bytes);
      await expectLongText(bytes, 'Default save');
    },
  );

  test(
    'saveAsBlob() and saveAsBase64() with default options: qpdf --check and pdf.js read the FlateDecode streams',
    { meta: { capability: ['cap-save-blob', 'cap-save-base64'] } },
    async () => {
      const blob = await longTextDoc('Default blob').saveAsBlob();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      const fromBlob = await blob.bytes();
      expectQpdfClean(fromBlob);
      await expectLongText(fromBlob, 'Default blob');

      const base64 = await longTextDoc('Default base64').saveAsBase64();
      expect(typeof base64).toBe('string');
      const fromBase64 = Uint8Array.fromBase64(base64);
      expectQpdfClean(fromBase64);
      await expectLongText(fromBase64, 'Default base64');

      const uri = await longTextDoc('Default data URI').saveAsBase64({ dataUri: true });
      expect(uri.startsWith('data:application/pdf;base64,')).toBe(true);
      const fromUri = Uint8Array.fromBase64(uri.slice('data:application/pdf;base64,'.length));
      expectQpdfClean(fromUri);
      await expectLongText(fromUri, 'Default data URI');
    },
  );

  test(
    'processBatch runs an operation over two loaded documents',
    { meta: { capability: ['cap-batch'] } },
    async () => {
      const inputs = [await cleanSave(textDoc('Batch one')), await cleanSave(textDoc('Batch two'))];
      const result = await processBatch(inputs, (doc) => doc.save(PLAIN), { concurrency: 1 });
      expect(result.successCount).toBe(2);
      expect(result.errors.size).toBe(0);
      for (const [i, bytes] of result.outputs.entries()) {
        expectQpdfClean(bytes);
        expect(await pdfjsText(bytes)).toEqual([i === 0 ? 'Batch one' : 'Batch two']);
      }
    },
  );
});

describe('signatures and the CLI', () => {
  /**
   * Signs a one-page document as 'Signature1', loads it, sets a title, saves it in full and joins
   * the two with saveIncrementalWithSignaturePreservation; every step passes qpdf --check.
   */
  async function preservedSave(): Promise<{ signed: Uint8Array; bytes: Uint8Array }> {
    const cert = await generateTestCert('Capability Signer');
    const plain = await cleanSave(textDoc('Signed page'));
    const signed = await signPdf(plain, 'Signature1', {
      certificate: cert.certificate,
      privateKey: cert.privateKey,
    });
    expectQpdfClean(signed);
    const modifiedDoc = await loadPdf(signed);
    modifiedDoc.setTitle('Modified');
    const modified = await modifiedDoc.save(PLAIN);
    expectQpdfClean(modified);
    const bytes = saveIncrementalWithSignaturePreservation(signed, modified);
    expectQpdfClean(bytes);
    return { signed, bytes };
  }

  // Not evidence for the signature-preservation row: the next marker shows the result carries a
  // second signature dictionary and the original signature no longer verifies.
  test('saveIncrementalWithSignaturePreservation keeps the signed bytes as a prefix; qpdf and pdf.js read the result', async () => {
    const { signed, bytes } = await preservedSave();
    expect(bytes.length).toBeGreaterThan(signed.length);
    expect(bytes.subarray(0, signed.length)).toEqual(signed);
    expect(await pdfjsText(bytes)).toEqual(['Signed page']);
  });

  // saveIncrementalWithSignaturePreservation appends the whole re-saved file as one update, so the
  // joined file holds two signature dictionaries (two /ByteRange entries), and verifySignatures
  // finds the appended copy next to the original.
  knownDefect(
    defectKey('legacy-M01', '0.41.2'),
    'saveIncrementalWithSignaturePreservation: verifySignatures finds the one original signature, intact',
    {
      failsWith:
        /^AssertionError: expected \[ 'Signature', 'Signature1' \] to deeply equal \[ 'Signature1' \]/,
    },
    async () => {
      const results = await verifySignatures((await preservedSave()).bytes);
      expect(results.map((r) => r.fieldName)).toEqual(['Signature1']);
      expect(results[0]?.integrityValid).toBe(true);
    },
  );

  test(
    'the CLI: `modern-pdf optimize <in> <out>` writes a PDF that qpdf and pdf.js read (needs dist/)',
    { meta: { capability: ['cap-cli'] } },
    async (ctx) => {
      const cli = join(ROOT, 'dist/cli/index.mjs');
      if (!existsSync(cli)) {
        if (process.env['CI'])
          throw new Error('dist/cli/index.mjs is missing: build before the oracle project');
        ctx.skip('dist/ not built: run pnpm exec tsdown first');
      }
      const dir = mkdtempSync(join(tmpdir(), 'cap-cli-'));
      try {
        const input = join(dir, 'in.pdf');
        const output = join(dir, 'out.pdf');
        writeFileSync(input, await cleanSave(textDoc('CLI page')));
        const run = spawnSync(process.execPath, [cli, 'optimize', input, output], {
          encoding: 'utf8',
        });
        expect(run.status, run.stderr).toBe(0);
        const bytes = new Uint8Array(readFileSync(output));
        expectQpdfClean(bytes);
        expect(await pdfjsText(bytes)).toEqual(['CLI page']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe('rows that are not about PDF bytes', () => {
  test(
    'pdfResponse() answers with the PDF bytes and an application/pdf content type',
    { meta: { capability: ['cap-server-adapters'] } },
    async () => {
      const bytes = await cleanSave(textDoc('Response page'));
      const response = pdfResponse(bytes);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(await response.bytes()).toEqual(bytes);
    },
  );

  test(
    'createSandbox().execute() throws ScriptExecutionDisabledError',
    { meta: { capability: ['cap-form-javascript'] } },
    () => {
      const run = (): unknown => createSandbox().execute('1 + 1');
      expect(run).toThrow(ScriptExecutionDisabledError);
      try {
        run();
      } catch (error) {
        expect((error as ScriptExecutionDisabledError).code).toBe('script-execution-disabled');
      }
    },
  );

  test(
    'the revocation functions the verification guide names are exported functions',
    { meta: { capability: ['cap-revocation-api'] } },
    () => {
      for (const fn of [checkCertificateStatus, downloadCrl, verifyOfflineRevocation]) {
        expect(fn).toBeTypeOf('function');
      }
    },
  );

  test(
    'package.json: one runtime dependency, ESM and CJS entries, Node >=26.4, TypeScript 7.1 dev',
    { meta: { capability: ['cap-package'] } },
    () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
        engines: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        exports: Record<string, { import?: unknown; require?: unknown }>;
      };
      expect(Object.keys(pkg.dependencies)).toEqual(['fflate']);
      expect(pkg.engines['node']).toBe('>=26.4');
      expect(pkg.exports['.']?.import).toBeDefined();
      expect(pkg.exports['.']?.require).toBeDefined();
      expect(pkg.devDependencies['typescript']).toMatch(/^7\.1\.0-dev\./);
      expect(readFileSync(join(ROOT, 'tsconfig.json'), 'utf8')).toMatch(/"strict":\s*true/);
    },
  );

  test(
    'CI: unit tests gate on Node 26 with the devEngines runtime as a probe; Playwright runs Chromium, Firefox and WebKit; no Deno, Bun or workerd job',
    { meta: { capability: ['cap-ci-runtimes'] } },
    () => {
      const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
      const playwright = readFileSync(join(ROOT, 'playwright.config.ts'), 'utf8');
      expect(ci).toMatch(/runtime: node@26/);
      expect(ci).not.toMatch(/runtime: node@24/);
      expect(ci).toMatch(/name: devEngines runtime/);
      expect(ci).toMatch(/playwright install/);
      for (const name of ['chromium', 'firefox', 'webkit']) {
        expect(playwright).toContain(`name: '${name}'`);
      }
      expect(ci).not.toMatch(/\b(deno|bun|wrangler|workerd)\b/i);
    },
  );
});
