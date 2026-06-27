/**
 * @module form/schemaForm
 *
 * Generate a fillable AcroForm PDF directly from a JSON-Schema-like
 * description.  Only the subset of JSON Schema that maps cleanly onto
 * PDF interactive form (AcroForm) field types is supported:
 *
 * | JSON Schema                       | AcroForm field            |
 * | --------------------------------- | ------------------------- |
 * | `type: 'string'`                  | text field                |
 * | `type: 'string'` + `enum: [...]`  | dropdown (combo box)      |
 * | `type: 'boolean'`                 | checkbox                  |
 * | `type: 'number'` / `'integer'`    | text field                |
 * | `type: 'object'` / `'array'`      | text field (placeholder)  |
 * | anything else / no `type`         | text field (placeholder)  |
 *
 * ### Documented limitations (intentional, honest scope)
 *
 * - **Nested objects and arrays are NOT recursed.** A property whose
 *   `type` is `'object'` or `'array'` becomes a single flat text-field
 *   placeholder labelled with the property name. Sub-properties of a
 *   nested object are ignored. (Recursive / repeatable structures have
 *   no first-class AcroForm representation.)
 * - **Unsupported / unknown `type` keywords** (and properties with no
 *   `type` at all) also degrade gracefully to a plain text field, so the
 *   generated document is always a valid, fillable PDF.
 * - Schema validation keywords (`minLength`, `pattern`, `minimum`,
 *   `multipleOf`, `oneOf`, `anyOf`, `$ref`, …) are **not** enforced; they
 *   are simply ignored. Only `type`, `properties`, `required`, `enum`,
 *   and `title` influence the output.
 * - `enum` is honoured only for `type: 'string'`. Enum values of other
 *   types fall through to their normal mapping.
 *
 * The returned {@link PdfDocument} is **not** saved — call `doc.save()`
 * (or any of the `saveAs*` variants) on it yourself.
 *
 * @example
 * ```ts
 * import { buildFormFromJsonSchema } from 'modern-pdf-lib/form/schemaForm';
 *
 * const { doc, fields } = buildFormFromJsonSchema({
 *   type: 'object',
 *   title: 'Signup',
 *   properties: {
 *     fullName: { type: 'string', title: 'Full Name' },
 *     subscribe: { type: 'boolean' },
 *     country: { type: 'string', enum: ['US', 'CA', 'MX'] },
 *   },
 *   required: ['fullName'],
 * });
 *
 * const bytes = await doc.save();
 * ```
 */

import { createPdf, PdfDocument } from '../core/pdfDocument.js';
import { PageSizes } from '../core/pdfPage.js';
import { rgb } from '../core/operators/color.js';
import {
  PdfArray,
  PdfBool,
  PdfDict,
  PdfName,
  PdfRef,
  PdfString,
} from '../core/pdfObjects.js';
import type { PdfPlugin } from '../plugins/pluginSystem.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The recognised subset of a JSON Schema node.  Extra keywords are
 * permitted by the index signature but ignored by the generator.
 */
export interface JsonSchemaLike {
  /** JSON Schema `type` keyword (`'object'`, `'string'`, `'boolean'`, …). */
  type?: string;
  /** Child property schemas, keyed by property name (object schemas). */
  properties?: Record<string, JsonSchemaLike>;
  /** Names of required properties. */
  required?: string[];
  /** Enumerated allowed values (used for string → dropdown mapping). */
  enum?: unknown[];
  /** Human-friendly title; used as the field label when present. */
  title?: string;
  /** Free-form description (currently unused by the generator). */
  description?: string;
  /** JSON Schema `format` hint (currently unused by the generator). */
  format?: string;
}

/** Options controlling the generated form's layout. */
export interface SchemaFormOptions {
  /** Document title drawn at the top of the first page. */
  title?: string | undefined;
  /** Page size as `[width, height]` in PDF points. Defaults to A4. */
  pageSize?: [number, number] | undefined;
  /** Width (points) reserved for the label column. Defaults to 160. */
  labelWidth?: number | undefined;
}

/** The kind of AcroForm field generated for a property. */
export type SchemaFieldKind = 'text' | 'checkbox' | 'dropdown';

/** One generated form field descriptor. */
export interface SchemaFormField {
  /** The field name (the schema property key). */
  name: string;
  /** The AcroForm field kind that was generated. */
  kind: SchemaFieldKind;
}

/** Result of {@link buildFormFromJsonSchema}. */
export interface SchemaFormResult {
  /** The generated document (NOT yet saved). */
  doc: PdfDocument;
  /** The fields that were generated, in property order. */
  fields: SchemaFormField[];
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Vertical space (points) allotted to each row (field + gap). */
const ROW_HEIGHT = 34;
/** Height (points) of a text / dropdown widget. */
const FIELD_HEIGHT = 20;
/** Side margin (points). */
const MARGIN = 48;
/** Top margin (points) below which fields start on each page. */
const TOP_MARGIN = 56;
/** Bottom margin (points); fields below this trigger a page break. */
const BOTTOM_MARGIN = 48;
/** Default label-column width (points). */
const DEFAULT_LABEL_WIDTH = 160;
/** Body font size for labels. */
const LABEL_SIZE = 11;
/** Title font size. */
const TITLE_SIZE = 18;

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Determine which AcroForm field kind a property schema maps to.
 *
 * @returns The field kind plus, for dropdowns, the list of options.
 */
function mapPropertyToKind(prop: JsonSchemaLike): {
  kind: SchemaFieldKind;
  options: string[];
} {
  const type = prop.type;

  if (type === 'boolean') {
    return { kind: 'checkbox', options: [] };
  }

  if (
    type === 'string' &&
    Array.isArray(prop.enum) &&
    prop.enum.length > 0
  ) {
    // string + enum → dropdown of the enum values rendered as strings.
    const options = prop.enum.map((v) => String(v));
    return { kind: 'dropdown', options };
  }

  // 'string', 'number', 'integer', 'object', 'array', unknown, and
  // missing types all degrade to a plain text field (documented).
  return { kind: 'text', options: [] };
}

// ---------------------------------------------------------------------------
// AcroForm wiring plugin
// ---------------------------------------------------------------------------

/**
 * Internal plugin that wires a freshly-built form into the document at
 * save time.  It runs after pages are finalized so it can:
 *
 *  - append each field's (pre-registered) indirect reference to its
 *    page's `/Annots` array (`onBuildPageDict`), and
 *  - register the `/AcroForm` dictionary on the catalog with a `/DR`
 *    default-resources entry and `/NeedAppearances true` so viewers
 *    generate the field appearances (`onBuildCatalog`).
 *
 * This avoids editing any shared document code: everything needed to
 * make `getForm()` fields round-trip is performed through the public
 * plugin hooks.
 */
function createAcroFormWiringPlugin(
  acroFormDict: PdfDict,
  acroFormRef: PdfRef,
  fieldRefsByPage: Map<number, PdfRef[]>,
): PdfPlugin {
  return {
    name: 'modern-pdf-lib:schemaForm-acroform-wiring',
    version: '1.0.0',

    onBuildPageDict(pageDict: PdfDict, pageIndex: number): void {
      const refs = fieldRefsByPage.get(pageIndex);
      if (refs === undefined || refs.length === 0) return;

      const existing = pageDict.get('/Annots');
      if (existing !== undefined && existing.kind === 'array') {
        for (const ref of refs) {
          (existing as PdfArray).push(ref);
        }
      } else {
        pageDict.set('/Annots', PdfArray.of([...refs]));
      }
    },

    onBuildCatalog(catalog: PdfDict): void {
      // Ensure default resources (/DR) exist with a Helvetica font so
      // viewers can render field text via the /DA default appearance.
      if (!acroFormDict.has('/DR')) {
        const helvetica = new PdfDict();
        helvetica.set('/Type', PdfName.of('Font'));
        helvetica.set('/Subtype', PdfName.of('Type1'));
        helvetica.set('/BaseFont', PdfName.of('Helvetica'));
        const fontDict = new PdfDict();
        fontDict.set('/Helv', helvetica);
        const resources = new PdfDict();
        resources.set('/Font', fontDict);
        acroFormDict.set('/DR', resources);
      }
      if (!acroFormDict.has('/DA')) {
        acroFormDict.set('/DA', PdfString.literal('/Helv 0 Tf 0 g'));
      }
      // Let the viewer build field appearances from the field values.
      acroFormDict.set('/NeedAppearances', PdfBool.TRUE);

      // The catalog references the AcroForm indirectly.
      catalog.set('/AcroForm', acroFormRef);
    },
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a fillable AcroForm PDF from a JSON-Schema-like description.
 *
 * For an object schema, the `properties` are iterated in insertion
 * order and one labelled form field is emitted per property.  Fields
 * are stacked top-down; when the vertical cursor runs off the page a
 * new page is added and the cursor reset.  Required fields (listed in
 * the schema's `required` array) are marked with a trailing asterisk in
 * their label.
 *
 * @param schema   The JSON-Schema-like description.
 * @param options  Optional layout options.
 * @returns        The generated (unsaved) {@link PdfDocument} and the
 *                 list of generated field descriptors.
 */
export function buildFormFromJsonSchema(
  schema: JsonSchemaLike,
  options?: SchemaFormOptions,
): SchemaFormResult {
  const doc = createPdf();
  const form = doc.getForm();

  const pageSize: [number, number] = options?.pageSize ?? [
    PageSizes.A4[0],
    PageSizes.A4[1],
  ];
  const [pageWidth, pageHeight] = pageSize;
  const labelWidth =
    options?.labelWidth !== undefined ? options.labelWidth : DEFAULT_LABEL_WIDTH;

  const fields: SchemaFormField[] = [];

  // Map of page index → field dict refs that must be added to /Annots.
  const fieldRefsByPage = new Map<number, PdfRef[]>();
  const registry = doc.getRegistry();

  // Register and capture the AcroForm dict ref up-front so the wiring
  // plugin can reference it from the catalog at save time.
  const acroFormDict = form.toDict(registry);
  const acroFormRef = registry.register(acroFormDict);

  // Collected indirect references to the registered field dictionaries.
  // After all fields are created we overwrite the AcroForm `/Fields`
  // array (which `create*Field` populates with *inline* dicts) so it
  // holds spec-correct indirect references instead.
  const fieldRefs: PdfRef[] = [];

  // --- Lay out the form ---

  let pageIndex = -1;
  let cursorY = 0;
  const fieldX = MARGIN + labelWidth;
  const fieldWidth = Math.max(40, pageWidth - fieldX - MARGIN);

  /** Start a fresh page and reset the vertical cursor. */
  const newPage = (): void => {
    doc.addPage(pageSize);
    pageIndex += 1;
    cursorY = pageHeight - TOP_MARGIN;
  };

  // Always have at least one page.
  newPage();

  // Title (first page only).
  const title = options?.title ?? schema.title;
  if (title !== undefined && title.length > 0) {
    const page = doc.getPage(pageIndex);
    page.drawText(title, {
      x: MARGIN,
      y: cursorY,
      size: TITLE_SIZE,
      color: rgb(0, 0, 0),
    });
    cursorY -= TITLE_SIZE + 18;
  }

  const properties = schema.type === 'object' ? schema.properties : undefined;
  const requiredSet = new Set(schema.required ?? []);

  if (properties !== undefined) {
    for (const [name, propSchema] of Object.entries(properties)) {
      const prop = propSchema ?? {};
      const { kind, options: dropdownOptions } = mapPropertyToKind(prop);

      // Page break when the next row would cross the bottom margin.
      if (cursorY - ROW_HEIGHT < BOTTOM_MARGIN) {
        newPage();
      }

      const page = doc.getPage(pageIndex);

      // Label (to the left of the field). Mark required fields with '*'.
      const labelText = prop.title ?? name;
      const required = requiredSet.has(name);
      const label = required ? `${labelText} *` : labelText;
      page.drawText(label, {
        x: MARGIN,
        y: cursorY - FIELD_HEIGHT + 6,
        size: LABEL_SIZE,
        color: required ? rgb(0.6, 0, 0) : rgb(0.1, 0.1, 0.1),
      });

      // Widget rectangle [x1, y1, x2, y2].
      const y1 = cursorY - FIELD_HEIGHT;
      const y2 = cursorY;

      let createdDict: PdfDict;
      if (kind === 'checkbox') {
        const cbSize = FIELD_HEIGHT;
        createdDict = form
          .createCheckbox(name, pageIndex, [fieldX, y1, fieldX + cbSize, y2])
          .getDict();
      } else if (kind === 'dropdown') {
        createdDict = form
          .createDropdown(
            name,
            pageIndex,
            [fieldX, y1, fieldX + fieldWidth, y2],
            dropdownOptions,
          )
          .getDict();
      } else {
        createdDict = form
          .createTextField(name, pageIndex, [
            fieldX,
            y1,
            fieldX + fieldWidth,
            y2,
          ])
          .getDict();
        // Draw a thin baseline so the (empty) text field reads as a blank.
        page.drawLine({
          start: { x: fieldX, y: y1 },
          end: { x: fieldX + fieldWidth, y: y1 },
          thickness: 0.5,
          color: rgb(0.6, 0.6, 0.6),
        });
      }

      // Register the field dict once and record its ref for /Fields and
      // the owning page's /Annots array.
      const ref = registry.register(createdDict);
      fieldRefs.push(ref);

      const pageRefs = fieldRefsByPage.get(pageIndex) ?? [];
      pageRefs.push(ref);
      fieldRefsByPage.set(pageIndex, pageRefs);

      fields.push({ name, kind });

      cursorY -= ROW_HEIGHT;
    }
  }

  // Overwrite /Fields with indirect references (replacing the inline
  // dicts that `create*Field` appended). Each field dict is now stored
  // exactly once in the registry and referenced from both /Fields and
  // its page's /Annots.
  acroFormDict.set('/Fields', PdfArray.of([...fieldRefs]));

  // Register the wiring plugin so the AcroForm + /Annots are emitted at
  // save time through the public plugin hooks (no shared-file edits).
  doc.use(createAcroFormWiringPlugin(acroFormDict, acroFormRef, fieldRefsByPage));

  return { doc, fields };
}
