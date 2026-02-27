/**
 * Tests for optional content groups (layers).
 *
 * Covers:
 * - PdfLayer creation, visibility, and serialization
 * - PdfLayerManager: add, get, remove, list
 * - OCProperties dictionary generation
 * - Content stream helpers (beginLayerContent, endLayerContent)
 * - PdfLayer.fromDict parsing
 * - PdfLayerManager.fromDict parsing
 */

import { describe, it, expect } from 'vitest';
import {
  PdfLayer,
  PdfLayerManager,
  beginLayerContent,
  endLayerContent,
} from '../../../src/layers/optionalContent.js';
import {
  PdfObjectRegistry,
  PdfDict,
  PdfName,
  PdfString,
  PdfArray,
  PdfRef,
  PdfBool,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// PdfLayer
// ---------------------------------------------------------------------------

describe('PdfLayer', () => {
  it('should store name and default visibility', () => {
    const layer = new PdfLayer('Background', true);
    expect(layer.getName()).toBe('Background');
    expect(layer.isVisible()).toBe(true);
  });

  it('should default to visible', () => {
    const layer = new PdfLayer('Layer1');
    expect(layer.isVisible()).toBe(true);
  });

  it('should allow toggling visibility', () => {
    const layer = new PdfLayer('Layer1', true);
    layer.setVisible(false);
    expect(layer.isVisible()).toBe(false);
    layer.setVisible(true);
    expect(layer.isVisible()).toBe(true);
  });

  it('should have no ref before toDict is called', () => {
    const layer = new PdfLayer('Test');
    expect(layer.getRef()).toBeUndefined();
  });

  it('should produce a valid OCG dict and return a ref', () => {
    const registry = new PdfObjectRegistry();
    const layer = new PdfLayer('MyLayer');
    const ref = layer.toDict(registry);

    expect(ref).toBeDefined();
    expect(ref.kind).toBe('ref');
    expect(layer.getRef()).toBe(ref);
  });

  it('should return the same ref on repeated toDict calls', () => {
    const registry = new PdfObjectRegistry();
    const layer = new PdfLayer('MyLayer');
    const ref1 = layer.toDict(registry);
    const ref2 = layer.toDict(registry);
    expect(ref1).toBe(ref2);
  });

  it('should parse from a dict with /Name', () => {
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('OCG'));
    dict.set('/Name', PdfString.literal('Parsed Layer'));

    const layer = PdfLayer.fromDict(dict);
    expect(layer.getName()).toBe('Parsed Layer');
    expect(layer.isVisible()).toBe(true); // default
  });

  it('should use default name when dict has no /Name', () => {
    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('OCG'));

    const layer = PdfLayer.fromDict(dict);
    expect(layer.getName()).toBe('Unnamed Layer');
  });
});

// ---------------------------------------------------------------------------
// PdfLayerManager
// ---------------------------------------------------------------------------

describe('PdfLayerManager', () => {
  it('should start with no layers', () => {
    const manager = new PdfLayerManager();
    expect(manager.getLayers()).toHaveLength(0);
  });

  it('should add layers', () => {
    const manager = new PdfLayerManager();
    const layer = manager.addLayer('Layer1');
    expect(layer.getName()).toBe('Layer1');
    expect(manager.getLayers()).toHaveLength(1);
  });

  it('should add layers with visibility', () => {
    const manager = new PdfLayerManager();
    const hidden = manager.addLayer('Hidden', false);
    expect(hidden.isVisible()).toBe(false);
  });

  it('should get a layer by name', () => {
    const manager = new PdfLayerManager();
    manager.addLayer('A');
    manager.addLayer('B');
    const found = manager.getLayer('B');
    expect(found).toBeDefined();
    expect(found!.getName()).toBe('B');
  });

  it('should return undefined for unknown layer names', () => {
    const manager = new PdfLayerManager();
    expect(manager.getLayer('Missing')).toBeUndefined();
  });

  it('should remove a layer by name', () => {
    const manager = new PdfLayerManager();
    manager.addLayer('A');
    manager.addLayer('B');
    manager.addLayer('C');
    manager.removeLayer('B');
    expect(manager.getLayers()).toHaveLength(2);
    expect(manager.getLayer('B')).toBeUndefined();
  });

  it('should return a copy from getLayers', () => {
    const manager = new PdfLayerManager();
    manager.addLayer('X');
    const layers = manager.getLayers();
    layers.pop(); // modify the copy
    expect(manager.getLayers()).toHaveLength(1); // original unchanged
  });

  it('should build OCProperties dictionary', () => {
    const registry = new PdfObjectRegistry();
    const manager = new PdfLayerManager();
    manager.addLayer('Visible', true);
    manager.addLayer('Hidden', false);

    const ocProps = manager.toOCProperties(registry);
    expect(ocProps).toBeDefined();
    expect(ocProps.kind).toBe('dict');

    // Should have /OCGs array
    const ocgs = ocProps.get('/OCGs');
    expect(ocgs).toBeDefined();
    expect(ocgs!.kind).toBe('array');

    // Should have /D (default config)
    const d = ocProps.get('/D');
    expect(d).toBeDefined();
    expect(d!.kind).toBe('dict');

    // Default config should have /ON and /OFF
    const dDict = d as PdfDict;
    expect(dDict.get('/ON')).toBeDefined();
    expect(dDict.get('/OFF')).toBeDefined();
    expect(dDict.get('/Order')).toBeDefined();
    expect(dDict.get('/BaseState')).toBeDefined();
  });

  it('should omit /OFF when all layers are visible', () => {
    const registry = new PdfObjectRegistry();
    const manager = new PdfLayerManager();
    manager.addLayer('A', true);
    manager.addLayer('B', true);

    const ocProps = manager.toOCProperties(registry);
    const d = ocProps.get('/D') as PdfDict;
    expect(d.get('/ON')).toBeDefined();
    expect(d.get('/OFF')).toBeUndefined();
  });

  it('should omit /ON when all layers are hidden', () => {
    const registry = new PdfObjectRegistry();
    const manager = new PdfLayerManager();
    manager.addLayer('A', false);
    manager.addLayer('B', false);

    const ocProps = manager.toOCProperties(registry);
    const d = ocProps.get('/D') as PdfDict;
    expect(d.get('/ON')).toBeUndefined();
    expect(d.get('/OFF')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Content stream helpers
// ---------------------------------------------------------------------------

describe('beginLayerContent', () => {
  it('should produce BDC operator with /OC', () => {
    const layer = new PdfLayer('Notes');
    const ops = beginLayerContent(layer);
    expect(ops).toBe('/OC /Notes BDC\n');
  });

  it('should sanitize special characters in layer name', () => {
    const layer = new PdfLayer('My Layer!');
    const ops = beginLayerContent(layer);
    expect(ops).toBe('/OC /My_Layer_ BDC\n');
  });
});

describe('endLayerContent', () => {
  it('should produce EMC operator', () => {
    expect(endLayerContent()).toBe('EMC\n');
  });
});

// ---------------------------------------------------------------------------
// PdfLayerManager.fromDict
// ---------------------------------------------------------------------------

describe('PdfLayerManager.fromDict', () => {
  it('should parse layers from OCProperties dict', () => {
    const registry = new PdfObjectRegistry();
    const manager = new PdfLayerManager();
    manager.addLayer('Layer1', true);
    manager.addLayer('Layer2', false);

    const ocProps = manager.toOCProperties(registry);

    // Build a resolver that can look up objects in the registry
    const resolver = (ref: PdfRef) => {
      return registry.resolve(ref) ?? new PdfDict();
    };

    const parsed = PdfLayerManager.fromDict(ocProps, resolver);
    const layers = parsed.getLayers();

    expect(layers).toHaveLength(2);
    expect(layers[0]!.getName()).toBe('Layer1');
    expect(layers[1]!.getName()).toBe('Layer2');
  });

  it('should handle empty OCProperties', () => {
    const dict = new PdfDict();
    const resolver = () => new PdfDict();
    const parsed = PdfLayerManager.fromDict(dict, resolver);
    expect(parsed.getLayers()).toHaveLength(0);
  });
});
