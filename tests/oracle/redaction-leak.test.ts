/**
 * Exit gate for redaction in 0.40.5: redaction by removal is not available, so
 * every entry point throws and the secret stays where it was.
 *
 * Four page kinds: a plain-text page, a Form XObject page, an image page and a
 * page loaded from a file.  For each:
 *
 * - a control shows the content is there: pdf.js (an independent text
 *   extractor) and a raw byte search see the secret, or the saved file holds
 *   the image;
 * - every public entry point (`redactRegions`, `markForRedaction` plus
 *   `PdfDocument.applyRedactions()`, annotation `applyRedaction`) throws
 *   `RedactionIncompleteError` with code `redaction-incomplete` and reason
 *   `redaction-unavailable`, and the page is unchanged;
 * - after the refused call the saved file still shows the secret to pdf.js
 *   and to the raw search, and `verifyRedactions` reports it where it is in
 *   page content, never clean.
 *
 * Every file a test writes with `compress: false` (the saves inside the Form
 * XObject and loaded fixtures included) goes through `qpdf --check`
 * (expectQpdfClean); a test that writes one skips with a reason where qpdf is
 * absent locally and fails when `CI` is set (requireQpdf).
 *
 * pdf.js is the legacy build for Node (no worker setup, no canvas).
 */

import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  applyRedaction,
  createPdf,
  loadPdf,
  PdfRedactAnnotation,
  redactRegions,
  RedactionIncompleteError,
  StandardFonts,
  verifyRedactions,
} from '../../src/index.js';
import type { PdfDocument, PdfPage, PdfRef, RedactRect } from '../../src/index.js';
import { expectQpdfClean, requireQpdf } from '../helpers/oracle/qpdf.js';

// ---------------------------------------------------------------------------
// Oracle helpers
// ---------------------------------------------------------------------------

/** A text item as pdf.js reports it, in page space. */
interface PdfjsBox {
  readonly page: number;
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Every text item pdf.js extracts from `bytes`, on every page. */
async function pdfjsBoxes(bytes: Uint8Array): Promise<PdfjsBox[]> {
  // getDocument transfers `data`; pass a copy so the caller keeps its bytes.
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 });
  try {
    const pdf = await task.promise;
    const out: PdfjsBox[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const transform: readonly unknown[] = item.transform;
        out.push({
          page: p - 1,
          str: item.str,
          x: Number(transform[4]),
          y: Number(transform[5]),
          width: item.width,
          height: item.height,
        });
      }
    }
    return out;
  } finally {
    await task.destroy();
  }
}

/** Whether a pdf.js item box meets a rect (edges inclusive). */
function meets(box: PdfjsBox, rect: RedactRect): boolean {
  const x0 = Math.min(box.x, box.x + box.width);
  const x1 = Math.max(box.x, box.x + box.width);
  const y0 = Math.min(box.y, box.y + box.height);
  const y1 = Math.max(box.y, box.y + box.height);
  return x0 <= rect.x + rect.width && x1 >= rect.x && y0 <= rect.y + rect.height && y1 >= rect.y;
}

function hexOf(text: string, upper: boolean): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += text.charCodeAt(i).toString(16).padStart(2, '0');
  return upper ? out.toUpperCase() : out;
}

/** Whether the raw bytes hold `text` as a literal, or as lowercase or uppercase hex. */
function rawContains(bytes: Uint8Array, text: string): boolean {
  const latin1 = new TextDecoder('latin1').decode(bytes);
  return (
    latin1.includes(text) ||
    latin1.includes(hexOf(text, false)) ||
    latin1.includes(hexOf(text, true))
  );
}

/** The page state a throwing call must leave as it was. */
function snapshot(page: PdfPage): {
  bytes: Uint8Array;
  ops: string;
  refs: PdfRef[];
  annots: number;
} {
  return {
    bytes: page.getContentStream(),
    ops: page.getContentStreamData(),
    refs: [...page.getOriginalContentRefs()],
    annots: page.getAnnotations().length,
  };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

const ENTRY_POINTS = [
  'redactRegions',
  'PdfDocument.applyRedactions',
  'annotation applyRedaction',
] as const;
type EntryPoint = (typeof ENTRY_POINTS)[number];

/**
 * Set up a redaction of `rect` on page 0 through `entry` (add the mark or the
 * /Redact annotation) and return the call that applies it.  The snapshot is
 * taken between the two, so the mark or annotation is part of "unchanged".
 */
function stage(entry: EntryPoint, doc: PdfDocument, page: PdfPage, rect: RedactRect): () => void {
  switch (entry) {
    case 'redactRegions':
      return () => {
        redactRegions(page, [rect]);
      };
    case 'PdfDocument.applyRedactions':
      page.markForRedaction([rect.x, rect.y, rect.width, rect.height]);
      return () => {
        doc.applyRedactions();
      };
    case 'annotation applyRedaction': {
      page.addExistingAnnotation(
        PdfRedactAnnotation.create({
          rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
        }),
      );
      const annotIndex = page.getAnnotations().length - 1;
      return () => {
        applyRedaction(doc, 0, annotIndex);
      };
    }
  }
}

/** Run `apply`; it must throw `RedactionIncompleteError` with reason `redaction-unavailable`. */
function expectUnavailable(apply: () => void): void {
  let caught: unknown;
  try {
    apply();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RedactionIncompleteError);
  if (!(caught instanceof RedactionIncompleteError)) return;
  expect(caught.code).toBe('redaction-incomplete');
  expect(caught.reason).toBe('redaction-unavailable');
  expect(caught.pageIndex).toBeUndefined();
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Fixture {
  readonly doc: PdfDocument;
  readonly page: PdfPage;
}

const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

/** A 300 x 300 page with each `[text, x, y]` line drawn in Helvetica 20 pt. */
async function helvetica(lines: Array<[string, number, number]>): Promise<Fixture> {
  const doc = createPdf();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 300]);
  for (const [text, x, y] of lines) page.drawText(text, { x, y, font, size: 20 });
  return { doc, page };
}

const plainFixture = (): Promise<Fixture> =>
  helvetica([
    ['SECRET', 10, 100],
    ['KEEP', 10, 200],
  ]);

/** Page A (Helvetica 20 pt `SECRET` at (10, 100)) drawn on page B as a Form XObject. */
async function formFixture(): Promise<Fixture> {
  const a = await helvetica([['SECRET', 10, 100]]);
  const doc = createPdf();
  const source = await a.doc.save({ compress: false });
  expectQpdfClean(source);
  const [embedded] = await doc.embedPdf(source, [0]);
  if (!embedded) throw new Error('embedPdf returned no page');
  const page = doc.addPage([300, 300]);
  page.drawPage(embedded, { x: 0, y: 0 });
  return { doc, page };
}

/** `KEEP` at (10, 200) and a 1x1 PNG drawn at (10, 100), 50 x 50. */
async function imageFixture(): Promise<Fixture> {
  const fixture = await helvetica([['KEEP', 10, 200]]);
  const img = await fixture.doc.embedPng(Uint8Array.from(atob(PNG_1x1), (c) => c.charCodeAt(0)));
  fixture.page.drawImage(img, { x: 10, y: 100, width: 50, height: 50 });
  return fixture;
}

/** The plain page saved, then loaded: a page whose content comes from a file. */
async function loadedFixture(): Promise<Fixture> {
  const source = await (await plainFixture()).doc.save({ compress: false });
  expectQpdfClean(source);
  const doc = await loadPdf(source);
  return { doc, page: doc.getPage(0) };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

const rect: RedactRect = { x: 0, y: 90, width: 200, height: 40 };

/** `savesWhileBuilt`: build() writes a file (and checks it with qpdf). */
const KINDS = [
  {
    kind: 'plain-text page',
    build: plainFixture,
    text: true,
    inPageContent: true,
    savesWhileBuilt: false,
  },
  {
    kind: 'Form XObject page',
    build: formFixture,
    text: true,
    inPageContent: false,
    savesWhileBuilt: true,
  },
  {
    kind: 'image page',
    build: imageFixture,
    text: false,
    inPageContent: false,
    savesWhileBuilt: false,
  },
  {
    kind: 'loaded page',
    build: loadedFixture,
    text: true,
    inPageContent: true,
    savesWhileBuilt: true,
  },
] as const;

/** Assert the secret (or the image) is still in the saved `bytes`. */
async function expectContentPresent(bytes: Uint8Array, text: boolean): Promise<void> {
  if (text) {
    expect(rawContains(bytes, 'SECRET')).toBe(true);
    const boxes = await pdfjsBoxes(bytes);
    expect(boxes.some((b) => b.str.includes('SECRET') && meets(b, rect))).toBe(true);
  } else {
    expect(new TextDecoder('latin1').decode(bytes)).toContain('/Subtype /Image');
  }
}

for (const { kind, build, text, inPageContent, savesWhileBuilt } of KINDS) {
  describe(`redaction exit gate: ${kind}`, () => {
    it('control: the content is in the saved file', async (ctx) => {
      requireQpdf(ctx);
      const { doc } = await build();
      const bytes = await doc.save({ compress: false });
      expectQpdfClean(bytes);
      await expectContentPresent(bytes, text);
    });

    for (const entry of ENTRY_POINTS) {
      it(`${entry} throws redaction-unavailable and leaves the page unchanged`, async (ctx) => {
        if (savesWhileBuilt) requireQpdf(ctx);
        const { doc, page } = await build();
        const apply = stage(entry, doc, page, rect);
        const before = snapshot(page);
        expectUnavailable(apply);
        expect(snapshot(page)).toEqual(before);
      });

      it(`${entry} leaves the secret in the saved file, and the verifier reports it`, async (ctx) => {
        requireQpdf(ctx);
        const { doc, page } = await build();
        const apply = stage(entry, doc, page, rect);
        expectUnavailable(apply);

        const bytes = await doc.save({ compress: false });
        expectQpdfClean(bytes);
        await expectContentPresent(bytes, text);

        const report = await verifyRedactions(bytes, [{ page: 0, ...rect }]);
        expect(report.clean).toBe(false);
        expect(report.warnings).toHaveLength(1);
        if (inPageContent) {
          expect(report.leaks.map((leak) => leak.text).join(' ')).toContain('SECRET');
        } else {
          expect(report.leaks).toEqual([]);
        }
      });
    }
  });
}
