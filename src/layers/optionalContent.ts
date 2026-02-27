/**
 * @module layers/optionalContent
 *
 * Optional content groups (OCGs) — commonly known as "layers" in PDF.
 *
 * OCGs allow content to be selectively shown or hidden in a PDF viewer.
 * They are used for things like:
 * - Print-only or screen-only content
 * - Multi-language overlays
 * - CAD drawing layers
 * - Watermark visibility control
 *
 * Reference: PDF 1.7 spec, §8.11 (Optional Content).
 */

import {
  PdfDict,
  PdfArray,
  PdfName,
  PdfString,
  PdfRef,
  PdfBool,
} from '../core/pdfObjects.js';
import type { PdfObjectRegistry, PdfObject } from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// PdfLayer
// ---------------------------------------------------------------------------

/**
 * Represents a single optional content group (layer) in a PDF.
 *
 * Each layer has a name and a default visibility state.  Content
 * can be associated with a layer using the `BDC`/`EMC` marked-content
 * operators in the content stream.
 */
export class PdfLayer {
  readonly name: string;
  private visible: boolean;
  private ref: PdfRef | undefined;

  constructor(name: string, visible: boolean = true) {
    this.name = name;
    this.visible = visible;
  }

  /** Check whether this layer is visible by default. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Set the default visibility of this layer. */
  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  /** Get the layer name. */
  getName(): string {
    return this.name;
  }

  /**
   * Get the indirect reference for this layer's OCG dictionary.
   * Only available after `toDict()` has been called.
   */
  getRef(): PdfRef | undefined {
    return this.ref;
  }

  /**
   * Serialize this layer as an OCG dictionary and register it in the
   * object registry.
   *
   * @param registry  The PDF object registry.
   * @returns         The indirect reference to the OCG dictionary.
   */
  toDict(registry: PdfObjectRegistry): PdfRef {
    if (this.ref) return this.ref;

    const dict = new PdfDict();
    dict.set('/Type', PdfName.of('OCG'));
    dict.set('/Name', PdfString.literal(this.name));

    // Intent: /View means the layer is for viewing, /Design for editing
    dict.set('/Intent', PdfName.of('View'));

    this.ref = registry.register(dict);
    return this.ref;
  }

  /**
   * Parse a PdfLayer from an OCG dictionary.
   *
   * @param dict  The OCG dictionary.
   * @returns     A PdfLayer instance.
   */
  static fromDict(dict: PdfDict): PdfLayer {
    const nameObj = dict.get('/Name');
    let name = 'Unnamed Layer';
    if (nameObj && 'value' in nameObj && typeof (nameObj as { value: unknown }).value === 'string') {
      name = (nameObj as { value: string }).value;
    }

    // Default visibility is determined by the /OCProperties /D /ON array,
    // but for a standalone parse we default to true
    return new PdfLayer(name, true);
  }
}

// ---------------------------------------------------------------------------
// PdfLayerManager
// ---------------------------------------------------------------------------

/**
 * Manages a collection of optional content groups (layers) for a PDF
 * document.
 *
 * Provides methods to add, remove, and query layers, and to serialize
 * the `/OCProperties` dictionary that goes into the catalog.
 */
export class PdfLayerManager {
  private layers: PdfLayer[] = [];

  /**
   * Add a new layer.
   *
   * @param name     The display name for the layer.
   * @param visible  Whether the layer is visible by default.
   * @returns        The newly created layer.
   */
  addLayer(name: string, visible: boolean = true): PdfLayer {
    const layer = new PdfLayer(name, visible);
    this.layers.push(layer);
    return layer;
  }

  /**
   * Get a layer by name.
   *
   * @param name  The layer name.
   * @returns     The layer, or `undefined` if not found.
   */
  getLayer(name: string): PdfLayer | undefined {
    return this.layers.find((l) => l.getName() === name);
  }

  /**
   * Get all layers.
   *
   * @returns  A copy of the layers array.
   */
  getLayers(): PdfLayer[] {
    return [...this.layers];
  }

  /**
   * Remove a layer by name.
   *
   * @param name  The layer name.
   */
  removeLayer(name: string): void {
    this.layers = this.layers.filter((l) => l.getName() !== name);
  }

  /**
   * Build the `/OCProperties` dictionary for the document catalog.
   *
   * This dictionary describes all optional content groups and their
   * default configurations.
   *
   * @param registry  The PDF object registry.
   * @returns         The `/OCProperties` dictionary (not indirect).
   */
  toOCProperties(registry: PdfObjectRegistry): PdfDict {
    const ocProps = new PdfDict();

    // /OCGs — array of references to all OCG dictionaries
    const ocgsArray = new PdfArray();
    const onArray = new PdfArray();
    const offArray = new PdfArray();
    const orderArray = new PdfArray();

    for (const layer of this.layers) {
      const ref = layer.toDict(registry);
      ocgsArray.push(ref);
      orderArray.push(ref);

      if (layer.isVisible()) {
        onArray.push(ref);
      } else {
        offArray.push(ref);
      }
    }

    ocProps.set('/OCGs', ocgsArray);

    // /D — default viewing configuration
    const defaultConfig = new PdfDict();
    defaultConfig.set('/Name', PdfString.literal('Default'));
    defaultConfig.set('/BaseState', PdfName.of('ON'));

    // /ON — layers that are visible by default
    if (onArray.length > 0) {
      defaultConfig.set('/ON', onArray);
    }

    // /OFF — layers that are hidden by default
    if (offArray.length > 0) {
      defaultConfig.set('/OFF', offArray);
    }

    // /Order — presentation order in the layer panel
    defaultConfig.set('/Order', orderArray);

    ocProps.set('/D', defaultConfig);

    return ocProps;
  }

  /**
   * Parse a PdfLayerManager from an `/OCProperties` dictionary.
   *
   * @param dict      The `/OCProperties` dictionary from the catalog.
   * @param resolver  A function that resolves indirect references.
   * @returns         A PdfLayerManager instance.
   */
  static fromDict(
    dict: PdfDict,
    resolver: (ref: PdfRef) => PdfObject,
  ): PdfLayerManager {
    const manager = new PdfLayerManager();

    const ocgsObj = dict.get('/OCGs');
    if (!ocgsObj || ocgsObj.kind !== 'array') return manager;

    const ocgsArray = ocgsObj as PdfArray;

    // Get the /OFF array from the default config
    const offSet = new Set<number>();
    const dObj = dict.get('/D');
    if (dObj && dObj.kind === 'dict') {
      const offObj = (dObj as PdfDict).get('/OFF');
      if (offObj && offObj.kind === 'array') {
        for (const item of (offObj as PdfArray).items) {
          if (item.kind === 'ref') {
            offSet.add((item as PdfRef).objectNumber);
          }
        }
      }
    }

    for (const item of ocgsArray.items) {
      let ocgDict: PdfDict | undefined;
      let refObjNum = -1;

      if (item.kind === 'ref') {
        refObjNum = (item as PdfRef).objectNumber;
        const resolved = resolver(item as PdfRef);
        if (resolved && resolved.kind === 'dict') {
          ocgDict = resolved as PdfDict;
        }
      } else if (item.kind === 'dict') {
        ocgDict = item as PdfDict;
      }

      if (ocgDict) {
        const layer = PdfLayer.fromDict(ocgDict);
        if (refObjNum >= 0 && offSet.has(refObjNum)) {
          layer.setVisible(false);
        }
        manager.layers.push(layer);
      }
    }

    return manager;
  }
}

// ---------------------------------------------------------------------------
// Content stream helpers
// ---------------------------------------------------------------------------

/**
 * Generate the PDF operator to begin optional content for a layer.
 *
 * This produces a `BDC` (begin marked-content with properties)
 * operator that activates the given layer.
 *
 * @param layer  The layer to activate.
 * @returns      The PDF operator string: `/OC /LayerName BDC\n`
 */
export function beginLayerContent(layer: PdfLayer): string {
  // The OCG is referenced by name in the Properties sub-dictionary
  // of the page's Resources. For simplicity, we use the layer name
  // as the property name (sanitized).
  const propName = sanitizeResourceName(layer.getName());
  return `/OC /${propName} BDC\n`;
}

/**
 * Generate the PDF operator to end optional content.
 *
 * @returns  The PDF operator string: `EMC\n`
 */
export function endLayerContent(): string {
  return 'EMC\n';
}

/** Sanitize a string for use as a PDF resource name. */
function sanitizeResourceName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
