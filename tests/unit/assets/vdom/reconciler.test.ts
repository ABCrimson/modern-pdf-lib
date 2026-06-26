import { describe, it, expect } from 'vitest';
import type { VNode } from '../../../../src/assets/vdom/reconciler.js';
import { h, renderToPdf } from '../../../../src/assets/vdom/reconciler.js';

/** Decode the first `n` bytes of a Uint8Array to a Latin-1 string. */
function header(bytes: Uint8Array, n = 5): string {
  return new TextDecoder('latin1').decode(bytes.subarray(0, n));
}

describe('vdom reconciler', () => {
  it('renders a document with a page containing a heading + text to %PDF- bytes', async () => {
    const tree: VNode = h(
      'document',
      {},
      h(
        'page',
        {},
        h('heading', { level: 1, text: 'Quarterly Report' }),
        h('text', { text: 'This is a body paragraph that flows beneath the heading.' }),
      ),
    );

    const bytes = await renderToPdf(tree);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(header(bytes)).toBe('%PDF-');
  });

  it('h() builds a well-formed text VNode', () => {
    const node = h('text', { text: 'x' });
    expect(node).toEqual({ type: 'text', text: 'x' });
  });

  it('h() builds a well-formed heading VNode with a defaulted level', () => {
    expect(h('heading', { text: 'Title' })).toEqual({ type: 'heading', level: 1, text: 'Title' });
    expect(h('heading', { level: 3, text: 'Sub' })).toEqual({ type: 'heading', level: 3, text: 'Sub' });
  });

  it('h() builds spacer and page container nodes', () => {
    expect(h('spacer', { height: 24 })).toEqual({ type: 'spacer', height: 24 });
    const page = h('page', {}, h('text', { text: 'a' }));
    expect(page.type).toBe('page');
    if (page.type === 'page') {
      expect(page.children.length).toBe(1);
    }
  });

  it('auto-wraps loose document children into a single page', async () => {
    const tree: VNode = h('document', {}, h('text', { text: 'loose paragraph, no explicit page' }));
    const bytes = await renderToPdf(tree);
    expect(header(bytes)).toBe('%PDF-');
  });

  it('renders a tiny document and a many-paragraph one without throwing, larger one is bigger', async () => {
    const tiny: VNode = h('document', {}, h('page', {}, h('text', { text: 'hi' })));

    const paragraphs: VNode[] = [];
    for (let i = 0; i < 60; i++) {
      paragraphs.push(h('heading', { level: 2, text: `Section ${i}` }));
      paragraphs.push(
        h('text', {
          text:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod ' +
            'tempor incididunt ut labore et dolore magna aliqua. ' +
            'Supercalifragilisticexpialidociousnonbreakableverylongtoken here too.',
        }),
      );
      paragraphs.push(h('spacer', { height: 8 }));
    }
    const big: VNode = h('document', {}, h('page', {}, ...paragraphs));

    const tinyBytes = await renderToPdf(tiny);
    const bigBytes = await renderToPdf(big);

    expect(header(tinyBytes)).toBe('%PDF-');
    expect(header(bigBytes)).toBe('%PDF-');
    expect(bigBytes.length).toBeGreaterThan(tinyBytes.length);
  });

  it('honors custom fontSize and margin options', async () => {
    const tree: VNode = h('page', {}, h('text', { text: 'configured render' }));
    const bytes = await renderToPdf(tree, { fontSize: 18, margin: 72 });
    expect(header(bytes)).toBe('%PDF-');
  });
});
