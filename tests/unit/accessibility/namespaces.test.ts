/**
 * Tests for PDF 2.0 structure namespaces (ISO 32000-2, §14.7.4).
 */

import { describe, it, expect } from 'vitest';
import {
  buildNamespace,
  buildNamespacesArray,
  PDF2_NAMESPACE,
  MATHML_NAMESPACE,
} from '../../../src/accessibility/namespaces.js';
import type { NamespaceDef } from '../../../src/accessibility/namespaces.js';
import { PdfDict, PdfName, PdfString } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Common namespace constants
// ---------------------------------------------------------------------------

describe('namespace identifier constants', () => {
  it('exposes the PDF 2.0 standard structure namespace', () => {
    expect(PDF2_NAMESPACE).toBe('http://iso.org/pdf2/ssn');
  });

  it('exposes the MathML namespace', () => {
    expect(MATHML_NAMESPACE).toBe('http://www.w3.org/1998/Math/MathML');
  });
});

// ---------------------------------------------------------------------------
// buildNamespace
// ---------------------------------------------------------------------------

describe('buildNamespace', () => {
  it('sets /Type to the Namespace name', () => {
    const dict = buildNamespace({ ns: PDF2_NAMESPACE });
    const type = dict.get('/Type');
    expect(type).toBeInstanceOf(PdfName);
    expect((type as PdfName).value).toBe('/Namespace');
  });

  it('stores /NS as a PDF string with the namespace URI', () => {
    const dict = buildNamespace({ ns: MATHML_NAMESPACE });
    const ns = dict.get('/NS');
    expect(ns).toBeInstanceOf(PdfString);
    expect((ns as PdfString).toText()).toBe(MATHML_NAMESPACE);
    expect((ns as PdfString).hex).toBe(false);
  });

  it('omits /Schema and /RoleMapNS when not provided', () => {
    const dict = buildNamespace({ ns: PDF2_NAMESPACE });
    expect(dict.has('/Schema')).toBe(false);
    expect(dict.has('/RoleMapNS')).toBe(false);
    // Only /Type and /NS.
    expect(dict.size).toBe(2);
  });

  it('adds /Schema as a literal string when supplied', () => {
    const dict = buildNamespace({
      ns: MATHML_NAMESPACE,
      schema: 'mathml-schema.xml',
    });
    const schema = dict.get('/Schema');
    expect(schema).toBeInstanceOf(PdfString);
    expect((schema as PdfString).toText()).toBe('mathml-schema.xml');
    expect((schema as PdfString).hex).toBe(false);
  });

  it('builds a /RoleMapNS dictionary mapping names to standard types', () => {
    const dict = buildNamespace({
      ns: MATHML_NAMESPACE,
      roleMap: { math: 'Figure', mrow: 'Span' },
    });
    const roleMap = dict.get('/RoleMapNS');
    expect(roleMap).toBeInstanceOf(PdfDict);

    const rm = roleMap as PdfDict;
    const math = rm.get('/math');
    const mrow = rm.get('/mrow');
    expect(math).toBeInstanceOf(PdfName);
    expect((math as PdfName).value).toBe('/Figure');
    expect(mrow).toBeInstanceOf(PdfName);
    expect((mrow as PdfName).value).toBe('/Span');
    expect(rm.size).toBe(2);
  });

  it('does not emit /RoleMapNS for an empty role map', () => {
    const dict = buildNamespace({ ns: PDF2_NAMESPACE, roleMap: {} });
    expect(dict.has('/RoleMapNS')).toBe(false);
  });

  it('handles a fully populated descriptor', () => {
    const def: NamespaceDef = {
      ns: 'http://example.com/ns',
      schema: 'https://example.com/schema.rng',
      roleMap: { Box: 'Div' },
    };
    const dict = buildNamespace(def);
    expect(dict.has('/Type')).toBe(true);
    expect(dict.has('/NS')).toBe(true);
    expect(dict.has('/Schema')).toBe(true);
    expect(dict.has('/RoleMapNS')).toBe(true);
    expect((dict.get('/NS') as PdfString).toText()).toBe('http://example.com/ns');
  });

  it('returns a fresh dictionary on each call', () => {
    const a = buildNamespace({ ns: PDF2_NAMESPACE });
    const b = buildNamespace({ ns: PDF2_NAMESPACE });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// buildNamespacesArray
// ---------------------------------------------------------------------------

describe('buildNamespacesArray', () => {
  it('builds an array with one entry per descriptor', () => {
    const arr = buildNamespacesArray([
      { ns: PDF2_NAMESPACE },
      { ns: MATHML_NAMESPACE, roleMap: { math: 'Figure' } },
    ]);
    expect(arr.length).toBe(2);
  });

  it('each item is a /Namespace dictionary with the right /NS', () => {
    const arr = buildNamespacesArray([{ ns: PDF2_NAMESPACE }, { ns: MATHML_NAMESPACE }]);
    const first = arr.items[0];
    const second = arr.items[1];
    expect(first).toBeInstanceOf(PdfDict);
    expect(second).toBeInstanceOf(PdfDict);
    expect(((first as PdfDict).get('/NS') as PdfString).toText()).toBe(PDF2_NAMESPACE);
    expect(((second as PdfDict).get('/NS') as PdfString).toText()).toBe(MATHML_NAMESPACE);
    expect(((first as PdfDict).get('/Type') as PdfName).value).toBe('/Namespace');
  });

  it('produces an empty array for no descriptors', () => {
    const arr = buildNamespacesArray([]);
    expect(arr.length).toBe(0);
  });
});

describe('buildNamespace text strings', () => {
  it('writes /NS and /Schema as text strings', () => {
    const dict = buildNamespace({
      ns: 'http://example.com/ns/\u65e5',
      schema: 'Gr\u00f6\u00dfe \u20ac.xml',
    });

    const ns = dict.get('/NS') as PdfString;
    expect(ns.textEncoding).toBe('utf-16be');
    expect(ns.toText()).toBe('http://example.com/ns/\u65e5');
    // PDFDocEncoding: one byte per character, U+20AC is 0xA0.
    expect([...(dict.get('/Schema') as PdfString).toBytes()]).toEqual([
      0x47, 0x72, 0xf6, 0xdf, 0x65, 0x20, 0xa0, 0x2e, 0x78, 0x6d, 0x6c,
    ]);
  });

  it('writes role map names from text as UTF-8 name bytes', () => {
    const dict = buildNamespace({
      ns: 'x',
      roleMap: { '\u898b\u51fa\u3057': 'H1', Kopf: '\u00dcberschrift' },
    });
    const roleMap = dict.get('/RoleMapNS') as PdfDict;

    const key = PdfName.fromBytes(new TextEncoder().encode('\u898b\u51fa\u3057')).value;
    expect(roleMap.get(key)).toBe(PdfName.of('H1'));
    const kopf = roleMap.get('/Kopf') as PdfName;
    expect(kopf.toText()).toBe('\u00dcberschrift');
    expect([...kopf.toBytes()]).toEqual([
      0xc3, 0x9c, 0x62, 0x65, 0x72, 0x73, 0x63, 0x68, 0x72, 0x69, 0x66, 0x74,
    ]);
  });
});
