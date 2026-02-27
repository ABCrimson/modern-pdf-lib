/**
 * Tests for the viewer preferences dictionary builder and parser.
 *
 * Covers:
 * - Building a ViewerPreferences dict from a JS object
 * - Parsing a ViewerPreferences dict back to a JS object
 * - All supported preference fields
 * - Boolean flags, name values, numeric values, arrays
 * - Round-trip consistency
 * - Edge cases (empty prefs, unknown values)
 */

import { describe, it, expect } from 'vitest';
import {
  buildViewerPreferencesDict,
  parseViewerPreferences,
} from '../../../src/metadata/viewerPreferences.js';
import type { ViewerPreferences } from '../../../src/metadata/viewerPreferences.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfBool,
  PdfArray,
} from '../../../src/core/pdfObjects.js';
import type { ByteWriter } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class StringWriter implements ByteWriter {
  private parts: string[] = [];

  write(data: Uint8Array): void {
    let s = '';
    for (const b of data) {
      s += String.fromCharCode(b);
    }
    this.parts.push(s);
  }

  writeString(str: string): void {
    this.parts.push(str);
  }

  toString(): string {
    return this.parts.join('');
  }
}

function serialize(obj: { serialize(w: ByteWriter): void }): string {
  const w = new StringWriter();
  obj.serialize(w);
  return w.toString();
}

// ---------------------------------------------------------------------------
// buildViewerPreferencesDict
// ---------------------------------------------------------------------------

describe('buildViewerPreferencesDict', () => {
  it('builds an empty dict for empty preferences', () => {
    const dict = buildViewerPreferencesDict({});
    expect(dict.size).toBe(0);
  });

  it('builds boolean flags', () => {
    const prefs: ViewerPreferences = {
      hideToolbar: true,
      hideMenubar: false,
      hideWindowUI: true,
      fitWindow: true,
      centerWindow: false,
      displayDocTitle: true,
    };

    const dict = buildViewerPreferencesDict(prefs);

    expect(serialize(dict.get('/HideToolbar')!)).toBe('true');
    expect(serialize(dict.get('/HideMenubar')!)).toBe('false');
    expect(serialize(dict.get('/HideWindowUI')!)).toBe('true');
    expect(serialize(dict.get('/FitWindow')!)).toBe('true');
    expect(serialize(dict.get('/CenterWindow')!)).toBe('false');
    expect(serialize(dict.get('/DisplayDocTitle')!)).toBe('true');
  });

  it('builds name values', () => {
    const prefs: ViewerPreferences = {
      nonFullScreenPageMode: 'UseOutlines',
      direction: 'R2L',
      printScaling: 'None',
      duplex: 'DuplexFlipShortEdge',
    };

    const dict = buildViewerPreferencesDict(prefs);

    expect(serialize(dict.get('/NonFullScreenPageMode')!)).toBe('/UseOutlines');
    expect(serialize(dict.get('/Direction')!)).toBe('/R2L');
    expect(serialize(dict.get('/PrintScaling')!)).toBe('/None');
    expect(serialize(dict.get('/Duplex')!)).toBe('/DuplexFlipShortEdge');
  });

  it('builds print page range array', () => {
    const prefs: ViewerPreferences = {
      printPageRange: [[1, 3], [5, 10]],
    };

    const dict = buildViewerPreferencesDict(prefs);
    const arr = dict.get('/PrintPageRange') as PdfArray;

    expect(arr).toBeInstanceOf(PdfArray);
    expect(arr.length).toBe(4);
    expect(serialize(arr.items[0]!)).toBe('1');
    expect(serialize(arr.items[1]!)).toBe('3');
    expect(serialize(arr.items[2]!)).toBe('5');
    expect(serialize(arr.items[3]!)).toBe('10');
  });

  it('builds numCopies', () => {
    const prefs: ViewerPreferences = {
      numCopies: 3,
    };

    const dict = buildViewerPreferencesDict(prefs);
    expect(serialize(dict.get('/NumCopies')!)).toBe('3');
  });

  it('only includes set properties', () => {
    const prefs: ViewerPreferences = {
      hideToolbar: true,
    };

    const dict = buildViewerPreferencesDict(prefs);
    expect(dict.size).toBe(1);
    expect(dict.has('/HideToolbar')).toBe(true);
    expect(dict.has('/HideMenubar')).toBe(false);
  });

  it('builds all preferences at once', () => {
    const prefs: ViewerPreferences = {
      hideToolbar: true,
      hideMenubar: true,
      hideWindowUI: true,
      fitWindow: true,
      centerWindow: true,
      displayDocTitle: true,
      nonFullScreenPageMode: 'UseThumbs',
      direction: 'L2R',
      printScaling: 'AppDefault',
      duplex: 'Simplex',
      printPageRange: [[1, 5]],
      numCopies: 2,
    };

    const dict = buildViewerPreferencesDict(prefs);
    expect(dict.size).toBe(12);
  });

  it('skips empty printPageRange', () => {
    const prefs: ViewerPreferences = {
      printPageRange: [],
    };

    const dict = buildViewerPreferencesDict(prefs);
    expect(dict.has('/PrintPageRange')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseViewerPreferences
// ---------------------------------------------------------------------------

describe('parseViewerPreferences', () => {
  it('parses an empty dict', () => {
    const dict = new PdfDict();
    const prefs = parseViewerPreferences(dict);

    expect(prefs.hideToolbar).toBeUndefined();
    expect(prefs.hideMenubar).toBeUndefined();
    expect(prefs.direction).toBeUndefined();
  });

  it('parses boolean flags', () => {
    const dict = new PdfDict();
    dict.set('/HideToolbar', PdfBool.of(true));
    dict.set('/HideMenubar', PdfBool.of(false));
    dict.set('/FitWindow', PdfBool.of(true));

    const prefs = parseViewerPreferences(dict);
    expect(prefs.hideToolbar).toBe(true);
    expect(prefs.hideMenubar).toBe(false);
    expect(prefs.fitWindow).toBe(true);
    expect(prefs.hideWindowUI).toBeUndefined();
  });

  it('parses name values', () => {
    const dict = new PdfDict();
    dict.set('/NonFullScreenPageMode', PdfName.of('UseOutlines'));
    dict.set('/Direction', PdfName.of('R2L'));
    dict.set('/PrintScaling', PdfName.of('None'));
    dict.set('/Duplex', PdfName.of('DuplexFlipLongEdge'));

    const prefs = parseViewerPreferences(dict);
    expect(prefs.nonFullScreenPageMode).toBe('UseOutlines');
    expect(prefs.direction).toBe('R2L');
    expect(prefs.printScaling).toBe('None');
    expect(prefs.duplex).toBe('DuplexFlipLongEdge');
  });

  it('parses print page range', () => {
    const dict = new PdfDict();
    dict.set('/PrintPageRange', PdfArray.of([
      PdfNumber.of(1),
      PdfNumber.of(3),
      PdfNumber.of(7),
      PdfNumber.of(10),
    ]));

    const prefs = parseViewerPreferences(dict);
    expect(prefs.printPageRange).toEqual([[1, 3], [7, 10]]);
  });

  it('parses numCopies', () => {
    const dict = new PdfDict();
    dict.set('/NumCopies', PdfNumber.of(5));

    const prefs = parseViewerPreferences(dict);
    expect(prefs.numCopies).toBe(5);
  });

  it('ignores unrecognized name values', () => {
    const dict = new PdfDict();
    dict.set('/NonFullScreenPageMode', PdfName.of('InvalidMode'));
    dict.set('/Direction', PdfName.of('U2D'));
    dict.set('/PrintScaling', PdfName.of('FitToPage'));
    dict.set('/Duplex', PdfName.of('Triplex'));

    const prefs = parseViewerPreferences(dict);
    expect(prefs.nonFullScreenPageMode).toBeUndefined();
    expect(prefs.direction).toBeUndefined();
    expect(prefs.printScaling).toBeUndefined();
    expect(prefs.duplex).toBeUndefined();
  });

  it('handles odd-length print page range gracefully', () => {
    const dict = new PdfDict();
    dict.set('/PrintPageRange', PdfArray.of([
      PdfNumber.of(1),
      PdfNumber.of(3),
      PdfNumber.of(5),
    ]));

    const prefs = parseViewerPreferences(dict);
    // Should parse only complete pairs
    expect(prefs.printPageRange).toEqual([[1, 3]]);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: build -> parse
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('round-trips all preferences', () => {
    const original: ViewerPreferences = {
      hideToolbar: true,
      hideMenubar: false,
      hideWindowUI: true,
      fitWindow: true,
      centerWindow: false,
      displayDocTitle: true,
      nonFullScreenPageMode: 'UseOutlines',
      direction: 'R2L',
      printScaling: 'None',
      duplex: 'DuplexFlipShortEdge',
      printPageRange: [[1, 5], [10, 15]],
      numCopies: 3,
    };

    const dict = buildViewerPreferencesDict(original);
    const parsed = parseViewerPreferences(dict);

    expect(parsed.hideToolbar).toBe(original.hideToolbar);
    expect(parsed.hideMenubar).toBe(original.hideMenubar);
    expect(parsed.hideWindowUI).toBe(original.hideWindowUI);
    expect(parsed.fitWindow).toBe(original.fitWindow);
    expect(parsed.centerWindow).toBe(original.centerWindow);
    expect(parsed.displayDocTitle).toBe(original.displayDocTitle);
    expect(parsed.nonFullScreenPageMode).toBe(original.nonFullScreenPageMode);
    expect(parsed.direction).toBe(original.direction);
    expect(parsed.printScaling).toBe(original.printScaling);
    expect(parsed.duplex).toBe(original.duplex);
    expect(parsed.printPageRange).toEqual(original.printPageRange);
    expect(parsed.numCopies).toBe(original.numCopies);
  });

  it('round-trips minimal preferences', () => {
    const original: ViewerPreferences = {
      displayDocTitle: true,
    };

    const dict = buildViewerPreferencesDict(original);
    const parsed = parseViewerPreferences(dict);

    expect(parsed.displayDocTitle).toBe(true);
    expect(parsed.hideToolbar).toBeUndefined();
  });

  it('round-trips all NonFullScreenPageMode values', () => {
    const modes: Array<'UseNone' | 'UseOutlines' | 'UseThumbs' | 'UseOC'> = [
      'UseNone', 'UseOutlines', 'UseThumbs', 'UseOC',
    ];

    for (const mode of modes) {
      const dict = buildViewerPreferencesDict({ nonFullScreenPageMode: mode });
      const parsed = parseViewerPreferences(dict);
      expect(parsed.nonFullScreenPageMode).toBe(mode);
    }
  });

  it('round-trips all direction values', () => {
    const dirs: Array<'L2R' | 'R2L'> = ['L2R', 'R2L'];

    for (const dir of dirs) {
      const dict = buildViewerPreferencesDict({ direction: dir });
      const parsed = parseViewerPreferences(dict);
      expect(parsed.direction).toBe(dir);
    }
  });

  it('round-trips all duplex values', () => {
    const dups: Array<'Simplex' | 'DuplexFlipShortEdge' | 'DuplexFlipLongEdge'> = [
      'Simplex', 'DuplexFlipShortEdge', 'DuplexFlipLongEdge',
    ];

    for (const dup of dups) {
      const dict = buildViewerPreferencesDict({ duplex: dup });
      const parsed = parseViewerPreferences(dict);
      expect(parsed.duplex).toBe(dup);
    }
  });
});
