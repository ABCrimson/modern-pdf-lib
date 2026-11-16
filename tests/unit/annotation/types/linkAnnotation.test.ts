/**
 * Tests for PdfLinkAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfLinkAnnotation } from '../../../../src/annotation/types/linkAnnotation.js';
import { InvalidArgumentError } from '../../../../src/errors.js';
import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
} from '../../../../src/core/pdfObjects.js';

describe('PdfLinkAnnotation', () => {
  describe('create with URL', () => {
    it('creates a URL link', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [50, 700, 200, 720],
        url: 'https://example.com',
      });

      expect(annot.getType()).toBe('Link');
      expect(annot.getUrl()).toBe('https://example.com');
      expect(annot.getDestination()).toBeUndefined();
    });
  });

  describe('create with destination', () => {
    it('creates a page destination link', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [50, 700, 200, 720],
        pageIndex: 3,
        fit: 'FitH',
      });

      const dest = annot.getDestination();
      expect(dest).toBeDefined();
      expect(Array.isArray(dest)).toBe(true);
      expect((dest as number[])[0]).toBe(3);
      expect((dest as [number, string])[1]).toBe('FitH');
    });

    it('defaults to Fit mode', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [0, 0, 100, 20],
        pageIndex: 0,
      });

      const dest = annot.getDestination() as [number, string];
      expect(dest[1]).toBe('Fit');
    });
  });

  describe('highlight mode', () => {
    it('defaults to Invert', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [0, 0, 100, 20],
        url: 'https://test.com',
      });
      expect(annot.getHighlightMode()).toBe('Invert');
    });

    it('sets highlight mode', () => {
      const annot = PdfLinkAnnotation.create({
        rect: [0, 0, 100, 20],
        highlightMode: 'Push',
      });
      expect(annot.getHighlightMode()).toBe('Push');
    });

    it('round-trips all highlight modes', () => {
      const modes = ['None', 'Invert', 'Outline', 'Push'] as const;
      for (const mode of modes) {
        const annot = PdfLinkAnnotation.create({
          rect: [0, 0, 100, 20],
          highlightMode: mode,
        });
        expect(annot.getHighlightMode()).toBe(mode);
      }
    });
  });

  describe('fromDict', () => {
    it('parses a URL link from dict', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('Link'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));

      const action = new PdfDict();
      action.set('/S', PdfName.of('URI'));
      action.set('/URI', PdfString.literal('https://parsed.com'));
      dict.set('/A', action);

      const annot = PdfLinkAnnotation.fromDict(dict);
      expect(annot.getUrl()).toBe('https://parsed.com');
    });

    it('parses a destination link from dict', () => {
      const dict = new PdfDict();
      dict.set('/Subtype', PdfName.of('Link'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
      dict.set('/Dest', PdfArray.of([PdfNumber.of(5), PdfName.of('FitH')]));

      const annot = PdfLinkAnnotation.fromDict(dict);
      const dest = annot.getDestination() as [number, string];
      expect(dest[0]).toBe(5);
      expect(dest[1]).toBe('FitH');
    });

    it('parses a named destination from dict', () => {
      const dict = new PdfDict();
      dict.set('/Subtype', PdfName.of('Link'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
      dict.set('/Dest', PdfString.literal('chapter2'));

      const annot = PdfLinkAnnotation.fromDict(dict);
      expect(annot.getDestination()).toBe('chapter2');
    });
  });

  describe('setters', () => {
    it('setUrl creates a URI action', () => {
      const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
      annot.setUrl('https://updated.com');
      expect(annot.getUrl()).toBe('https://updated.com');
    });

    it('setDestination updates the dest', () => {
      const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
      annot.setDestination(7, 'FitV');
      const dest = annot.getDestination() as [number, string];
      expect(dest[0]).toBe(7);
      expect(dest[1]).toBe('FitV');
    });

    it('setHighlightMode updates the mode', () => {
      const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
      annot.setHighlightMode('None');
      expect(annot.getHighlightMode()).toBe('None');
    });
  });
});

describe('PdfLinkAnnotation strings', () => {
  it('reads a named destination and a URI given in hex form', () => {
    const dict = new PdfDict();
    dict.set('/Subtype', PdfName.of('Link'));
    dict.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
    dict.set('/Dest', PdfString.fromHex('6368617074657232'));
    const action = new PdfDict();
    action.set('/S', PdfName.of('URI'));
    action.set('/URI', PdfString.fromHex('68747470733a2f2f782e6f7267'));
    const other = new PdfDict();
    other.set('/Subtype', PdfName.of('Link'));
    other.set('/Rect', PdfArray.fromNumbers([0, 0, 100, 20]));
    other.set('/A', action);

    expect(PdfLinkAnnotation.fromDict(dict).getDestination()).toBe('chapter2');
    expect(PdfLinkAnnotation.fromDict(other).getUrl()).toBe('https://x.org');

    dict.set('/Dest', PdfString.fromText('chapter2', 'utf-16be'));
    action.set('/URI', PdfString.fromText('https://x.org', 'utf-16be'));
    expect(PdfLinkAnnotation.fromDict(dict).getDestination()).toBe('chapter2');
    expect(PdfLinkAnnotation.fromDict(other).getUrl()).toBe('https://x.org');
  });

  it('throws InvalidArgumentError for a non-ASCII URL that is not absolute', () => {
    const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
    let err: unknown;
    try {
      annot.setUrl('docs/ü.html');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(InvalidArgumentError);
    expect(err).toMatchObject({ code: 'invalid-argument', argument: 'url' });
  });

  it('writes an ASCII URL unchanged', () => {
    const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
    annot.setUrl('https://example.com/a b?x=1&y=(2)');
    expect(annot.getUrl()).toBe('https://example.com/a b?x=1&y=(2)');
  });

  it('writes a URL with non-ASCII characters percent-encoded as UTF-8', () => {
    const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
    annot.setUrl('https://example.com/ü/日本?q=ü#é');
    const uri = (annot.getDict().get('/A') as PdfDict).get('/URI') as PdfString;
    expect(uri.toText()).toBe('https://example.com/%C3%BC/%E6%97%A5%E6%9C%AC?q=%C3%BC#%C3%A9');
    expect(uri.toBytes().every((byte) => byte < 0x80)).toBe(true);
    expect(annot.getUrl()).toBe(uri.toText());
  });

  it('writes the host of a URL with non-ASCII characters as punycode', () => {
    const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20] });
    annot.setUrl('https://bücher.example/');
    expect(annot.getUrl()).toBe('https://xn--bcher-kva.example/');
  });

  it('creates a link whose URL has non-ASCII characters through the options', () => {
    const annot = PdfLinkAnnotation.create({ rect: [0, 0, 100, 20], url: 'https://example.com/ü' });
    expect(annot.getUrl()).toBe('https://example.com/%C3%BC');
  });
});
