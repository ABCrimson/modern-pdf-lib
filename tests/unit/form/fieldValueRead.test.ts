/**
 * Form values read as text, and the user-text names of check boxes and radio buttons built from
 * the UTF-8 bytes of the text (ISO 32000-2 7.3.5, 7.9.2.2, 12.7.5.2).
 *
 * Strings: /T, /V, /Opt, /CA and /RV are text strings, read through `PdfString.toText()`, so a
 * UTF-16BE or UTF-8 value reads as the text it encodes. /DA is content-stream syntax, read as
 * its bytes.
 *
 * Names: an on-state or a radio option is a name whose bytes are the UTF-8 encoding of the text,
 * read back through `PdfName.toText()`. Each name test saves the document, checks the file with
 * `qpdf --check`, loads it and reads the form of the loaded file. The form API writes no field
 * to the saved file and reads no form of a loaded one yet (forms-35, forms-34), so the test lists
 * the fields in the catalog through a plugin's `onBuildCatalog` hook and reads them back with
 * `PdfForm.fromDict` over the registry of the loaded document.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import {
  createPdf,
  loadPdf,
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  PdfString,
} from '../../../src/index.js';
import type { PdfDocument } from '../../../src/index.js';
import type { PdfObject, PdfRef } from '../../../src/core/pdfObjects.js';
import { flattenForm } from '../../../src/form/formFlatten.js';
import { FieldFlags } from '../../../src/form/pdfField.js';
import { PdfForm } from '../../../src/form/pdfForm.js';
import { expectQpdfClean, requireQpdf } from '../../helpers/oracle/qpdf.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A form of one field built from `dict`, its references resolved by a throwing resolver. */
function formOf(dict: PdfDict): PdfForm {
  const acroForm = new PdfDict();
  acroForm.set('/Fields', PdfArray.of([dict]));
  return PdfForm.fromDict(acroForm, () => {
    throw new Error('the test form holds no reference');
  });
}

/** A field dictionary merged with its widget: /FT, /T and /Rect set. */
function fieldDict(type: string, name: PdfString): PdfDict {
  const dict = new PdfDict();
  dict.set('/FT', PdfName.of(type));
  dict.set('/T', name);
  dict.set('/Type', PdfName.of('Annot'));
  dict.set('/Subtype', PdfName.of('Widget'));
  dict.set('/Rect', PdfArray.fromNumbers([50, 700, 250, 730]));
  return dict;
}

describe('form strings read as text', () => {
  test('a text field named and valued in UTF-16BE reads back the text', () => {
    const dict = fieldDict('Tx', PdfString.fromText('名前'));
    dict.set('/V', PdfString.fromText('日本語 €'));
    const field = formOf(dict).getTextField('名前');
    expect(field.getText()).toBe('日本語 €');
  });

  test('a text field valued in UTF-8 with a byte order mark reads back the text', () => {
    const dict = fieldDict('Tx', PdfString.fromText('city'));
    dict.set('/V', PdfString.fromText('Zürich', 'utf-8'));
    expect(formOf(dict).getTextField('city').getText()).toBe('Zürich');
  });

  test('a dropdown reads its /Opt strings, export and display pairs, and /V as text', () => {
    const dict = fieldDict('Ch', PdfString.fromText('size'));
    dict.set('/Ff', PdfNumber.of(FieldFlags.Combo));
    dict.set(
      '/Opt',
      PdfArray.of([
        PdfString.fromText('Größe €'),
        PdfArray.of([PdfString.fromText('jp'), PdfString.fromText('日本')]),
      ]),
    );
    dict.set('/V', PdfString.fromText('Größe €'));
    const field = formOf(dict).getDropdown('size');
    expect(field.getOptions()).toEqual(['Größe €', '日本']);
    expect(field.getSelected()).toBe('Größe €');
  });

  test('a list box reads its /Opt strings and a /V array as text', () => {
    const dict = fieldDict('Ch', PdfString.fromText('cities'));
    dict.set(
      '/Opt',
      PdfArray.of([
        PdfString.fromText('東京'),
        PdfArray.of([PdfString.fromText('mu'), PdfString.fromText('München €')]),
      ]),
    );
    dict.set('/V', PdfArray.of([PdfString.fromText('東京'), PdfString.fromText('München €')]));
    const field = formOf(dict).getListbox('cities');
    expect(field.getOptions()).toEqual(['東京', 'München €']);
    expect(field.getSelected()).toEqual(['東京', 'München €']);
  });

  test('a list box reads a single /V string as text', () => {
    const dict = fieldDict('Ch', PdfString.fromText('city'));
    dict.set('/V', PdfString.fromText('東京'));
    expect(formOf(dict).getListbox('city').getSelected()).toEqual(['東京']);
  });

  test('a push button reads its /MK /CA caption as text', () => {
    const dict = fieldDict('Btn', PdfString.fromText('send'));
    dict.set('/Ff', PdfNumber.of(FieldFlags.Pushbutton));
    const mk = new PdfDict();
    mk.set('/CA', PdfString.fromText('送信 €'));
    dict.set('/MK', mk);
    expect(formOf(dict).getButton('send').getCaption()).toBe('送信 €');
  });

  test('flattening reads a UTF-16BE /RV as the rich text it encodes', () => {
    const dict = fieldDict('Tx', PdfString.fromText('note'));
    dict.set('/V', PdfString.fromText('Plain'));
    dict.set('/DA', PdfString.fromAscii('/Helv 12 Tf 0 g'));
    dict.set('/RV', PdfString.fromText('<body><p><b>Bold Text</b></p></body>', 'utf-16be'));
    const result = flattenForm(formOf(dict));
    const content = new TextDecoder().decode(result.xObjects[0]?.stream.data);
    expect(content).toContain('/HeBo');
    expect(content).toContain('Bold Text');
  });
});

// ---------------------------------------------------------------------------
// Names built from user text, through save, qpdf --check and loadPdf
// ---------------------------------------------------------------------------

/**
 * Saves `doc` with `fields` (field dictionaries, each a widget or a parent of widget kids) in
 * the catalog's /AcroForm and their widgets in the page's /Annots, checks the file with qpdf,
 * and returns the form read from the loaded file. A stream must be an indirect object, so the
 * appearance streams of each /AP /N dictionary are registered and referenced first.
 */
async function saveCheckLoad(doc: PdfDocument, fields: readonly PdfDict[]): Promise<PdfForm> {
  const registry = doc.getRegistry();
  const registerWidget = (widget: PdfDict): PdfRef => {
    const ap = widget.get('/AP');
    const n = ap instanceof PdfDict ? ap.get('/N') : undefined;
    if (n instanceof PdfDict) {
      for (const [key, value] of n) {
        if (value instanceof PdfStream) n.set(key, registry.register(value));
      }
    }
    return registry.register(widget);
  };
  const annots: PdfRef[] = [];
  const fieldRefs = fields.map((field) => {
    const kids = field.get('/Kids');
    const fieldRef = kids instanceof PdfArray ? registry.register(field) : registerWidget(field);
    if (kids instanceof PdfArray) {
      const kidRefs = kids.items.map((kid) => {
        if (!(kid instanceof PdfDict)) throw new Error('the test fields hold widget dictionaries');
        kid.set('/Parent', fieldRef);
        return registerWidget(kid);
      });
      field.set('/Kids', PdfArray.of(kidRefs));
      annots.push(...kidRefs);
    } else {
      annots.push(fieldRef);
    }
    return fieldRef;
  });
  doc.use({
    name: 'field-value-read-acroform',
    onBuildCatalog(catalog) {
      const acroForm = new PdfDict();
      acroForm.set('/Fields', PdfArray.of(fieldRefs));
      catalog.set('/AcroForm', acroForm);
    },
    onBuildPageDict(page) {
      page.set('/Annots', PdfArray.of(annots));
    },
  });
  const bytes = await doc.save();
  expectQpdfClean(bytes);

  const loaded = await loadPdf(bytes);
  const objects = new Map<number, PdfObject>();
  for (const { ref, object } of loaded.getRegistry()) objects.set(ref.objectNumber, object);
  const resolve = (ref: PdfRef): PdfObject => {
    const object = objects.get(ref.objectNumber);
    if (object === undefined) throw new Error(`object ${ref.objectNumber} is not in the file`);
    return object;
  };
  for (const object of objects.values()) {
    const acroForm = object instanceof PdfDict ? object.get('/AcroForm') : undefined;
    if (acroForm !== undefined) {
      const dict = acroForm.kind === 'ref' ? resolve(acroForm as PdfRef) : acroForm;
      if (!(dict instanceof PdfDict)) throw new Error('/AcroForm is not a dictionary');
      return PdfForm.fromDict(dict, resolve);
    }
  }
  throw new Error('the loaded file has no /AcroForm');
}

/** The bytes of a name entry of `dict`. */
function nameBytes(dict: PdfDict, key: string): Uint8Array | undefined {
  const name = dict.get(key);
  return name instanceof PdfName ? name.toBytes() : undefined;
}

describe('on-state names of loaded fields keep their bytes', () => {
  test('a radio option that is not UTF-8 reads with U+FFFD and select writes its own bytes', () => {
    const latin1Key = `/Gr${String.fromCharCode(0xf6, 0xdf)}e`;
    const states = new PdfDict();
    states.set(latin1Key, new PdfStream(new PdfDict(), new Uint8Array(0)));
    states.set('/Off', new PdfStream(new PdfDict(), new Uint8Array(0)));
    const ap = new PdfDict();
    ap.set('/N', states);
    const widget = new PdfDict();
    widget.set('/AP', ap);
    const field = new PdfDict();
    field.set('/FT', PdfName.of('Btn'));
    field.set('/Ff', PdfNumber.of(FieldFlags.Radio));
    field.set('/T', PdfString.fromText('size'));
    field.set('/Kids', PdfArray.of([widget]));
    const group = formOf(field).getRadioGroup('size');
    expect(group.getOptions()).toEqual(['Gr��e']);
    group.select('Gr��e');
    expect(nameBytes(field, '/V')).toEqual(Uint8Array.of(0x47, 0x72, 0xf6, 0xdf, 0x65));
    expect(nameBytes(widget, '/AS')).toEqual(Uint8Array.of(0x47, 0x72, 0xf6, 0xdf, 0x65));
  });
});

const RECTS = [
  { x: 50, y: 700, width: 20, height: 20 },
  { x: 50, y: 670, width: 20, height: 20 },
];

describe('user-text names round-trip through save, qpdf --check and loadPdf', () => {
  beforeEach((ctx) => {
    requireQpdf(ctx);
  });

  test('radio options given to createRadioGroup become /AP /N names of their UTF-8 bytes', async () => {
    const doc = createPdf();
    doc.addPage();
    const group = doc.getForm().createRadioGroup('size', 0, RECTS, ['Größe', '日本']);
    const loaded = (await saveCheckLoad(doc, [group.getDict()])).getRadioGroup('size');
    expect(loaded.getOptions()).toEqual(['Größe', '日本']);
    expect(loaded.getSelected()).toBeUndefined();
  });

  test('a radio option chosen with select is written as the name of its UTF-8 bytes', async () => {
    const doc = createPdf();
    doc.addPage();
    const group = doc.getForm().createRadioGroup('size', 0, RECTS, ['Größe', '日本']);
    group.select('日本');
    const loaded = (await saveCheckLoad(doc, [group.getDict()])).getRadioGroup('size');
    expect(loaded.getSelected()).toBe('日本');
    expect(nameBytes(loaded.getDict(), '/V')).toEqual(utf8('日本'));
    expect(loaded.getWidgets().map((widget) => nameBytes(widget, '/AS'))).toEqual([
      utf8('Off'),
      utf8('日本'),
    ]);
  });

  test('a check box checked on a UTF-8 on-state reads the on-state back as text', async () => {
    const doc = createPdf();
    doc.addPage();
    const box = doc.getForm().createCheckbox('agree', 0, [50, 700, 70, 720]);
    const onState = new PdfDict();
    onState.set(
      PdfName.fromBytes(utf8('Größe')).value,
      new PdfStream(new PdfDict(), new Uint8Array(0)),
    );
    onState.set('/Off', new PdfStream(new PdfDict(), new Uint8Array(0)));
    const ap = new PdfDict();
    ap.set('/N', onState);
    box.getWidgetDict().set('/AP', ap);
    expect(box.getOnValue()).toBe('Größe');
    box.check();
    const loaded = (await saveCheckLoad(doc, [box.getDict()])).getCheckbox('agree');
    expect(loaded.isChecked()).toBe(true);
    expect(loaded.getOnValue()).toBe('Größe');
    expect(nameBytes(loaded.getDict(), '/V')).toEqual(utf8('Größe'));
    expect(nameBytes(loaded.getWidgetDict(), '/AS')).toEqual(utf8('Größe'));
  });
});
