/**
 * Tests for per-page / per-stream output intents (ISO 32000-2 §14.11.5).
 *
 * Covers:
 * - attachOutputIntents: sets /OutputIntents array, appends on repeat calls
 * - buildPageOutputIntent: builds an /OutputIntent dict with /DestOutputProfile,
 *   default /S, custom subtype, /OutputConditionIdentifier, /Info.
 */

import { describe, it, expect } from 'vitest';
import {
  attachOutputIntents,
  buildPageOutputIntent,
} from '../../../src/compliance/pageOutputIntent.js';
import type { PageOutputIntentOptions } from '../../../src/compliance/pageOutputIntent.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfString,
  PdfStream,
  PdfArray,
  PdfNumber,
  PdfRef,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// attachOutputIntents
// ---------------------------------------------------------------------------

describe('attachOutputIntents', () => {
  it('sets /OutputIntents to an array containing the given refs', () => {
    const target = new PdfDict();
    const ref = PdfRef.of(7);
    attachOutputIntents(target, [ref]);

    const intents = target.get('/OutputIntents');
    expect(intents).toBeInstanceOf(PdfArray);
    const arr = intents as PdfArray;
    expect(arr.length).toBe(1);
    expect(arr.items[0]).toBe(ref);
  });

  it('sets multiple refs in order', () => {
    const target = new PdfDict();
    const a = PdfRef.of(1);
    const b = PdfRef.of(2);
    attachOutputIntents(target, [a, b]);

    const arr = target.get('/OutputIntents') as PdfArray;
    expect(arr.length).toBe(2);
    expect(arr.items[0]).toBe(a);
    expect(arr.items[1]).toBe(b);
  });

  it('appends to an existing /OutputIntents array on a second call', () => {
    const target = new PdfDict();
    const first = PdfRef.of(10);
    const second = PdfRef.of(11);

    attachOutputIntents(target, [first]);
    attachOutputIntents(target, [second]);

    const arr = target.get('/OutputIntents') as PdfArray;
    expect(arr.length).toBe(2);
    expect(arr.items[0]).toBe(first);
    expect(arr.items[1]).toBe(second);
  });

  it('reuses the same array instance when appending', () => {
    const target = new PdfDict();
    attachOutputIntents(target, [PdfRef.of(3)]);
    const arr1 = target.get('/OutputIntents');
    attachOutputIntents(target, [PdfRef.of(4)]);
    const arr2 = target.get('/OutputIntents');
    expect(arr2).toBe(arr1);
  });

  it('does nothing observable for an empty ref list but still creates the array', () => {
    const target = new PdfDict();
    attachOutputIntents(target, []);
    const arr = target.get('/OutputIntents') as PdfArray;
    expect(arr).toBeInstanceOf(PdfArray);
    expect(arr.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildPageOutputIntent
// ---------------------------------------------------------------------------

describe('buildPageOutputIntent', () => {
  it('returns a PdfRef', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry);
    expect(ref).toBeInstanceOf(PdfRef);
  });

  it('resolves to a dict with /Type /OutputIntent', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, { outputConditionIdentifier: 'sRGB' });
    const obj = registry.resolve(ref);
    expect(obj).toBeInstanceOf(PdfDict);
    const dict = obj as PdfDict;

    const type = dict.get('/Type');
    expect(type).toBeInstanceOf(PdfName);
    expect((type as PdfName).value).toBe('/OutputIntent');
  });

  it('has a /DestOutputProfile pointing at an ICC profile stream', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, { outputConditionIdentifier: 'sRGB' });
    const dict = registry.resolve(ref) as PdfDict;

    const dest = dict.get('/DestOutputProfile');
    expect(dest).toBeInstanceOf(PdfRef);
    const profile = registry.resolve(dest as PdfRef);
    expect(profile).toBeInstanceOf(PdfStream);
  });

  it('defaults /S to /GTS_PDFA1', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry);
    const dict = registry.resolve(ref) as PdfDict;

    const s = dict.get('/S');
    expect(s).toBeInstanceOf(PdfName);
    expect((s as PdfName).value).toBe('/GTS_PDFA1');
  });

  it('uses a custom subtype', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, { subtype: '/GTS_PDFX' });
    const dict = registry.resolve(ref) as PdfDict;

    const s = dict.get('/S') as PdfName;
    expect(s.value).toBe('/GTS_PDFX');
  });

  it('sets /OutputConditionIdentifier from options', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, {
      outputConditionIdentifier: 'FOGRA39L',
    });
    const dict = registry.resolve(ref) as PdfDict;

    const oci = dict.get('/OutputConditionIdentifier');
    expect(oci).toBeInstanceOf(PdfString);
    expect((oci as PdfString).value).toBe('FOGRA39L');
  });

  it('sets /Info when provided', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, {
      outputConditionIdentifier: 'sRGB',
      info: 'sRGB IEC61966-2.1',
    });
    const dict = registry.resolve(ref) as PdfDict;

    const info = dict.get('/Info');
    expect(info).toBeInstanceOf(PdfString);
    expect((info as PdfString).value).toBe('sRGB IEC61966-2.1');
  });

  it('omits /Info when not provided', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, { outputConditionIdentifier: 'sRGB' });
    const dict = registry.resolve(ref) as PdfDict;
    expect(dict.has('/Info')).toBe(false);
  });

  it('honours a custom ICC profile and component count', () => {
    const registry = new PdfObjectRegistry();
    const custom = new Uint8Array([1, 2, 3, 4]);
    const options: PageOutputIntentOptions = {
      iccProfile: custom,
      components: 4,
    };
    const ref = buildPageOutputIntent(registry, options);
    const dict = registry.resolve(ref) as PdfDict;

    const profileRef = dict.get('/DestOutputProfile') as PdfRef;
    const stream = registry.resolve(profileRef) as PdfStream;
    expect(stream.data).toBe(custom);

    const n = stream.dict.get('/N');
    expect(n).toBeInstanceOf(PdfNumber);
    expect((n as PdfNumber).value).toBe(4);
  });

  it('integrates with attachOutputIntents on a page dict', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildPageOutputIntent(registry, { outputConditionIdentifier: 'sRGB' });

    const page = new PdfDict();
    page.set('/Type', PdfName.of('Page'));
    attachOutputIntents(page, [ref]);

    const arr = page.get('/OutputIntents') as PdfArray;
    expect(arr.items).toContain(ref);

    // A second per-page intent appends.
    const ref2 = buildPageOutputIntent(registry, { subtype: '/GTS_PDFX' });
    attachOutputIntents(page, [ref2]);
    expect(arr.length).toBe(2);
    expect(arr.items[1]).toBe(ref2);
  });
});
