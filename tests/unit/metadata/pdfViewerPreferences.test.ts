import { describe, it, expect } from 'vitest';
import { PdfViewerPreferences } from '../../../src/metadata/pdfViewerPreferences.js';

describe('PdfViewerPreferences', () => {
  it('initializes with defaults', () => {
    const prefs = new PdfViewerPreferences();
    expect(prefs.getHideToolbar()).toBe(false);
    expect(prefs.getHideMenubar()).toBe(false);
    expect(prefs.getHideWindowUI()).toBe(false);
    expect(prefs.getFitWindow()).toBe(false);
    expect(prefs.getCenterWindow()).toBe(false);
    expect(prefs.getDisplayDocTitle()).toBe(false);
    expect(prefs.getNumCopies()).toBe(1);
    expect(prefs.getPickTrayByPDFSize()).toBe(false);
    expect(prefs.getPrintPageRange()).toBeUndefined();
    expect(prefs.getDuplex()).toBeUndefined();
    expect(prefs.getNonFullScreenPageMode()).toBe('UseNone');
    expect(prefs.getDirection()).toBe('L2R');
    expect(prefs.getPrintScaling()).toBe('AppDefault');
  });

  it('sets and gets boolean properties', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setHideToolbar(true);
    expect(prefs.getHideToolbar()).toBe(true);

    prefs.setHideMenubar(true);
    expect(prefs.getHideMenubar()).toBe(true);

    prefs.setHideWindowUI(true);
    expect(prefs.getHideWindowUI()).toBe(true);

    prefs.setFitWindow(true);
    expect(prefs.getFitWindow()).toBe(true);

    prefs.setCenterWindow(true);
    expect(prefs.getCenterWindow()).toBe(true);

    prefs.setDisplayDocTitle(true);
    expect(prefs.getDisplayDocTitle()).toBe(true);

    prefs.setPickTrayByPDFSize(true);
    expect(prefs.getPickTrayByPDFSize()).toBe(true);
  });

  it('sets and gets enum properties', () => {
    const prefs = new PdfViewerPreferences();

    prefs.setNonFullScreenPageMode('UseOutlines');
    expect(prefs.getNonFullScreenPageMode()).toBe('UseOutlines');

    prefs.setDirection('R2L');
    expect(prefs.getDirection()).toBe('R2L');

    prefs.setPrintScaling('None');
    expect(prefs.getPrintScaling()).toBe('None');

    prefs.setDuplex('DuplexFlipShortEdge');
    expect(prefs.getDuplex()).toBe('DuplexFlipShortEdge');
  });

  it('sets and gets numCopies', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setNumCopies(5);
    expect(prefs.getNumCopies()).toBe(5);
  });

  it('sets and gets printPageRange', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setPrintPageRange([[0, 3], [5, 7]]);
    expect(prefs.getPrintPageRange()).toEqual([[0, 3], [5, 7]]);
  });

  it('constructs from existing ViewerPreferences object', () => {
    const prefs = new PdfViewerPreferences({
      hideToolbar: true,
      direction: 'R2L',
      numCopies: 3,
    });
    expect(prefs.getHideToolbar()).toBe(true);
    expect(prefs.getDirection()).toBe('R2L');
    expect(prefs.getNumCopies()).toBe(3);
  });

  it('exports to plain object', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setHideToolbar(true);
    prefs.setDirection('R2L');
    const obj = prefs.toObject();
    expect(obj.hideToolbar).toBe(true);
    expect(obj.direction).toBe('R2L');
  });

  it('toDict() produces a PdfDict', () => {
    const prefs = new PdfViewerPreferences();
    prefs.setHideToolbar(true);
    prefs.setNumCopies(3);
    const dict = prefs.toDict();
    // PdfDict should have the entries set
    expect(dict).toBeDefined();
    expect(dict.get('/HideToolbar')).toBeDefined();
    expect(dict.get('/NumCopies')).toBeDefined();
  });

  it('does not mutate original data passed to constructor', () => {
    const original = { hideToolbar: true, numCopies: 2 };
    const prefs = new PdfViewerPreferences(original);
    prefs.setHideToolbar(false);
    prefs.setNumCopies(10);
    // Original should be unchanged
    expect(original.hideToolbar).toBe(true);
    expect(original.numCopies).toBe(2);
  });
});
