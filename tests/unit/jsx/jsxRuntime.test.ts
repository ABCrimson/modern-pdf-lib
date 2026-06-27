/**
 * End-to-end tests for the JSX/hyperscript PDF renderer (`src/jsx/jsxRuntime.ts`).
 *
 * Every assertion goes through the REAL parser: we render an element tree to
 * PDF bytes, load those bytes with `PdfDocument.load`, then extract the page's
 * text via `parseContentStream(page.getContentStream())` + `extractText`.
 * Nothing is asserted by eyeballing the content stream string.
 */
import { describe, it, expect } from 'vitest';
import { PdfDocument } from '../../../src/core/pdfDocument.js';
import { PageSizes } from '../../../src/core/pdfPage.js';
import { parseContentStream } from '../../../src/parser/contentStreamParser.js';
import { extractText } from '../../../src/parser/textExtractor.js';
import {
  h,
  jsx,
  jsxs,
  Fragment,
  renderToPdf,
  type PdfNode,
} from '../../../src/jsx/jsxRuntime.js';

/** Load rendered bytes and return the extracted text of every page. */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  expect(bytes).toBeInstanceOf(Uint8Array);
  // Header check: valid PDFs begin with "%PDF-".
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 5));
  expect(header).toBe('%PDF-');

  const doc = await PdfDocument.load(bytes);
  const texts: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const ops = parseContentStream(page.getContentStream());
    texts.push(extractText(ops, page.getOriginalResources()));
  }
  return texts;
}

describe('jsxRuntime — renderToPdf', () => {
  it('renders the spec example: a document with one page and two stacked text lines', async () => {
    const bytes = await renderToPdf(
      h(
        'document',
        { size: PageSizes.A4 },
        h(
          'page',
          null,
          h('text', { size: 24 }, 'Hello'),
          h('text', null, 'World'),
        ),
      ),
    );

    const texts = await pageTexts(bytes);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Hello');
    expect(texts[0]).toContain('World');
  });

  it('starts a new PDF page for each <page> element (two pages → 2 pages)', async () => {
    const bytes = await renderToPdf(
      h(
        'document',
        null,
        h('page', null, h('text', null, 'PageOne')),
        h('page', null, h('text', null, 'PageTwo')),
      ),
    );

    const texts = await pageTexts(bytes);
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain('PageOne');
    expect(texts[1]).toContain('PageTwo');
    // Content does not bleed across pages.
    expect(texts[0]).not.toContain('PageTwo');
    expect(texts[1]).not.toContain('PageOne');
  });

  it('renders a function component by calling it with its props', async () => {
    const Greeting = (props: Record<string, unknown>): PdfNode =>
      h('text', null, `Hi ${String(props['name'])}`);

    const bytes = await renderToPdf(
      h('document', null, h('page', null, h(Greeting, { name: 'Ada' }))),
    );

    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('Hi Ada');
  });

  it('renders a Fragment as a transparent group of children', async () => {
    const bytes = await renderToPdf(
      h(
        'document',
        null,
        h(
          'page',
          null,
          h(Fragment, null, h('text', null, 'Alpha'), h('text', null, 'Beta')),
        ),
      ),
    );

    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('Alpha');
    expect(texts[0]).toContain('Beta');
  });

  it('places absolutely-positioned text at the requested coordinate', async () => {
    // Absolute placement: explicit x/y should NOT participate in block flow.
    const bytes = await renderToPdf(
      h(
        'document',
        { size: [300, 300] as const },
        h('page', null, h('text', { x: 120, y: 60, size: 14 }, 'Anchored')),
      ),
    );

    const doc = await PdfDocument.load(bytes);
    const page = doc.getPage(0);
    const { extractTextWithPositions } = await import(
      '../../../src/parser/textExtractor.js'
    );
    const ops = parseContentStream(page.getContentStream());
    const items = extractTextWithPositions(ops, page.getOriginalResources());
    const anchored = items.find((i) => i.text.includes('Anchored'));
    if (anchored === undefined) {
      throw new Error('expected an "Anchored" text item to be extracted');
    }
    // Tm/Td translation should reflect the absolute x/y we asked for.
    expect(anchored.x).toBeCloseTo(120, 0);
    expect(anchored.y).toBeCloseTo(60, 0);
  });

  it('nests a <view> container and still renders its child text', async () => {
    const bytes = await renderToPdf(
      h(
        'document',
        null,
        h(
          'page',
          null,
          h('text', null, 'Header'),
          h(
            'view',
            { padding: 20, background: undefined },
            h('text', null, 'Inside'),
            h('text', null, 'Block'),
          ),
        ),
      ),
    );

    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('Header');
    expect(texts[0]).toContain('Inside');
    expect(texts[0]).toContain('Block');
  });

  it('renders a <rect> without throwing and keeps sibling text', async () => {
    const bytes = await renderToPdf(
      h(
        'document',
        null,
        h(
          'page',
          null,
          h('rect', { x: 10, y: 10, width: 100, height: 50 }),
          h('text', { x: 10, y: 80 }, 'Labelled'),
        ),
      ),
    );

    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('Labelled');
  });

  it('ignores null / undefined / boolean / empty children', async () => {
    const bytes = await renderToPdf(
      h(
        'document',
        null,
        h(
          'page',
          null,
          null,
          undefined,
          false,
          true,
          h('text', null, 'Survivor'),
        ),
      ),
    );

    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('Survivor');
  });

  it('supports the automatic-runtime jsx() / jsxs() entry points', async () => {
    // jsxs is used for static-children elements; children live in props.children.
    const tree = jsx('document', {
      children: jsxs('page', {
        children: [
          jsx('text', { size: 18, children: 'AutoOne' }),
          jsx('text', { children: 'AutoTwo' }),
        ],
      }),
    });

    const bytes = await renderToPdf(tree);
    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('AutoOne');
    expect(texts[0]).toContain('AutoTwo');
  });

  it('renders a bare string/number child of <page> as a text line', async () => {
    const bytes = await renderToPdf(
      h('document', null, h('page', null, 'BareString', 42)),
    );
    const texts = await pageTexts(bytes);
    expect(texts[0]).toContain('BareString');
    expect(texts[0]).toContain('42');
  });
});
