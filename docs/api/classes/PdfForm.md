[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfForm

# Class: PdfForm

Defined in: [src/form/pdfForm.ts:132](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L132)

Represents a PDF document's interactive form (AcroForm).

Provides access to all form fields, bulk fill, and flatten operations.

## Constructors

### Constructor

> **new PdfForm**(`fields`, `acroFormDict`): `PdfForm`

Defined in: [src/form/pdfForm.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L142)

#### Parameters

##### fields

[`PdfField`](PdfField.md)[]

##### acroFormDict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfForm`

## Methods

### createButton()

> **createButton**(`name`, `page`, `rect`, `label?`): [`PdfButtonField`](PdfButtonField.md)

Defined in: [src/form/pdfForm.ts:648](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L648)

Create a new push button and add it to the form.

#### Parameters

##### name

`string`

Field name.

##### page

`unknown`

The PdfPage where the widget appears.

##### rect

Widget rectangle `{x, y, width, height}`.

###### height

`number`

###### width

`number`

###### x

`number`

###### y

`number`

##### label?

`string`

Optional button caption.

#### Returns

[`PdfButtonField`](PdfButtonField.md)

The newly created button field.

***

### createCheckbox()

> **createCheckbox**(`name`, `page`, `rect`): [`PdfCheckboxField`](PdfCheckboxField.md)

Defined in: [src/form/pdfForm.ts:530](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L530)

Create a new checkbox and add it to the form.

#### Parameters

##### name

`string`

Field name.

##### page

`number`

Page index (zero-based).

##### rect

\[`number`, `number`, `number`, `number`\]

Widget rectangle [x1, y1, x2, y2].

#### Returns

[`PdfCheckboxField`](PdfCheckboxField.md)

The newly created checkbox field.

***

### createDropdown()

> **createDropdown**(`name`, `page`, `rect`, `options`): [`PdfDropdownField`](PdfDropdownField.md)

Defined in: [src/form/pdfForm.ts:555](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L555)

Create a new dropdown and add it to the form.

#### Parameters

##### name

`string`

Field name.

##### page

`number`

Page index (zero-based).

##### rect

\[`number`, `number`, `number`, `number`\]

Widget rectangle [x1, y1, x2, y2].

##### options

`string`[]

The list of option strings.

#### Returns

[`PdfDropdownField`](PdfDropdownField.md)

The newly created dropdown field.

***

### createListbox()

> **createListbox**(`name`, `page`, `rect`, `options`): [`PdfListboxField`](PdfListboxField.md)

Defined in: [src/form/pdfForm.ts:685](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L685)

Create a new listbox and add it to the form.

A listbox is a choice field (/FT /Ch) without the Combo flag,
displaying a scrollable list of options.

#### Parameters

##### name

`string`

Field name.

##### page

`unknown`

The PdfPage where the widget appears.

##### rect

Widget rectangle `{x, y, width, height}`.

###### height

`number`

###### width

`number`

###### x

`number`

###### y

`number`

##### options

`string`[]

The list of option strings.

#### Returns

[`PdfListboxField`](PdfListboxField.md)

The newly created listbox field.

***

### createRadioGroup()

> **createRadioGroup**(`name`, `page`, `rects`, `options?`): [`PdfRadioGroup`](PdfRadioGroup.md)

Defined in: [src/form/pdfForm.ts:589](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L589)

Create a new radio button group and add it to the form.

A radio group is a single field with multiple widget annotations,
one per rectangle in `rects`.  Each widget corresponds to an
option; if `options` is supplied the n-th option labels the n-th
widget, otherwise options default to `"Option0"`, `"Option1"`, etc.

#### Parameters

##### name

`string`

Field name.

##### page

`unknown`

The PdfPage where the widgets appear (unused for
                positioning in the low-level dict, but reserved
                for future page-level annotation linking).

##### rects

`object`[]

Array of widget rectangles `{x, y, width, height}`.

##### options?

`string`[]

Optional option labels (one per rect).

#### Returns

[`PdfRadioGroup`](PdfRadioGroup.md)

The newly created radio group.

***

### createTextField()

> **createTextField**(`name`, `page`, `rect`): [`PdfTextField`](PdfTextField.md)

Defined in: [src/form/pdfForm.ts:507](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L507)

Create a new text field and add it to the form.

#### Parameters

##### name

`string`

Field name.

##### page

`number`

Page index (zero-based) where the widget appears.

##### rect

\[`number`, `number`, `number`, `number`\]

Widget rectangle [x1, y1, x2, y2].

#### Returns

[`PdfTextField`](PdfTextField.md)

The newly created text field.

***

### deleteXFA()

> **deleteXFA**(): `void`

Defined in: [src/form/pdfForm.ts:487](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L487)

Remove the /XFA entry from the AcroForm dictionary, if present.

XFA (XML Forms Architecture) data can cause PDF viewers to use the
XFA renderer instead of the standard AcroForm renderer, which is
often undesirable.  Removing /XFA forces viewers to fall back to
the AcroForm fields.

After removing /XFA, `/NeedAppearances` is set to `true` so that
the viewer knows it must generate appearances for the AcroForm
fields (since XFA appearances are no longer available).

This method is a no-op if the AcroForm dictionary does not contain
an /XFA entry.

#### Returns

`void`

***

### fill()

> **fill**(`values`): `void`

Defined in: [src/form/pdfForm.ts:413](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L413)

Fill multiple fields at once.

Accepts a record where keys are field names and values are the
field values to set.  Strings map to text/dropdown/listbox values;
booleans map to checkbox checked states.

#### Parameters

##### values

`Record`\<`string`, `string` \| `boolean`\>

A mapping of field name to value.

#### Returns

`void`

#### Throws

If a field name is not found.

***

### flatten()

> **flatten**(): `void`

Defined in: [src/form/pdfForm.ts:442](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L442)

Flatten the form: burn field values into the page content streams
and remove the interactive form structure.

After flattening, the document is no longer interactive — field
values become static page content. This is done by:

1. Generating appearance streams for all fields that lack them
2. Removing the /AcroForm entry from the catalog
3. Removing /Widget annotations from page /Annots arrays

Note: In this implementation, we mark the form as flattened by
setting a flag and clearing the /Fields array. The appearance
streams remain as page annotations will reference them.

#### Returns

`void`

***

### getButton()

> **getButton**(`name`): [`PdfButtonField`](PdfButtonField.md)

Defined in: [src/form/pdfForm.ts:369](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L369)

Get a button field by name.
Throws if the field is not found or is not a button.

#### Parameters

##### name

`string`

#### Returns

[`PdfButtonField`](PdfButtonField.md)

***

### getCheckbox()

> **getCheckbox**(`name`): [`PdfCheckboxField`](PdfCheckboxField.md)

Defined in: [src/form/pdfForm.ts:301](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L301)

Get a checkbox field by name.
Throws if the field is not found or is not a checkbox.

#### Parameters

##### name

`string`

#### Returns

[`PdfCheckboxField`](PdfCheckboxField.md)

***

### getDropdown()

> **getDropdown**(`name`): [`PdfDropdownField`](PdfDropdownField.md)

Defined in: [src/form/pdfForm.ts:335](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L335)

Get a dropdown field by name.
Throws if the field is not found or is not a dropdown.

#### Parameters

##### name

`string`

#### Returns

[`PdfDropdownField`](PdfDropdownField.md)

***

### getField()

> **getField**(`name`): [`PdfField`](PdfField.md) \| `undefined`

Defined in: [src/form/pdfForm.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L276)

Get a field by name (partial or fully-qualified).
Returns undefined if not found.

#### Parameters

##### name

`string`

#### Returns

[`PdfField`](PdfField.md) \| `undefined`

***

### getFields()

> **getFields**(): [`PdfField`](PdfField.md)[]

Defined in: [src/form/pdfForm.ts:268](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L268)

Get all fields in the form.

#### Returns

[`PdfField`](PdfField.md)[]

***

### getListbox()

> **getListbox**(`name`): [`PdfListboxField`](PdfListboxField.md)

Defined in: [src/form/pdfForm.ts:352](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L352)

Get a listbox field by name.
Throws if the field is not found or is not a listbox.

#### Parameters

##### name

`string`

#### Returns

[`PdfListboxField`](PdfListboxField.md)

***

### getRadioGroup()

> **getRadioGroup**(`name`): [`PdfRadioGroup`](PdfRadioGroup.md)

Defined in: [src/form/pdfForm.ts:318](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L318)

Get a radio group by name.
Throws if the field is not found or is not a radio group.

#### Parameters

##### name

`string`

#### Returns

[`PdfRadioGroup`](PdfRadioGroup.md)

***

### getSignatureField()

> **getSignatureField**(`name`): [`PdfSignatureField`](PdfSignatureField.md)

Defined in: [src/form/pdfForm.ts:386](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L386)

Get a signature field by name.
Throws if the field is not found or is not a signature field.

#### Parameters

##### name

`string`

#### Returns

[`PdfSignatureField`](PdfSignatureField.md)

***

### getTextField()

> **getTextField**(`name`): [`PdfTextField`](PdfTextField.md)

Defined in: [src/form/pdfForm.ts:284](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L284)

Get a text field by name.
Throws if the field is not found or is not a text field.

#### Parameters

##### name

`string`

#### Returns

[`PdfTextField`](PdfTextField.md)

***

### hasXFA()

> **hasXFA**(): `boolean`

Defined in: [src/form/pdfForm.ts:468](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L468)

Check whether the AcroForm dictionary contains XFA data.

XFA (XML Forms Architecture) data causes PDF viewers to use the
XFA renderer instead of the standard AcroForm renderer. Use
[deleteXFA](#deletexfa) to remove it.

#### Returns

`boolean`

`true` if the form has an /XFA entry.

***

### removeField()

> **removeField**(`name`): `void`

Defined in: [src/form/pdfForm.ts:715](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L715)

Remove a field from the form by name.

Removes the field from the internal field list, the name index,
and the /Fields array in the AcroForm dictionary.

#### Parameters

##### name

`string`

The field name (partial or fully-qualified).

#### Returns

`void`

#### Throws

If no field with the given name exists.

***

### toDict()

> **toDict**(`registry`): [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfForm.ts:756](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L756)

Serialize the form back to a PdfDict.

Updates /NeedAppearances if appearances need to be generated
by the viewer.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

#### Returns

[`PdfDict`](PdfDict.md)

***

### fromDict()

> `static` **fromDict**(`acroFormDict`, `resolver`): `PdfForm`

Defined in: [src/form/pdfForm.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfForm.ts#L169)

Build a PdfForm from a parsed /AcroForm dictionary.

Traverses the /Fields array and resolves indirect references to
construct the field tree, then flattens it into a list of concrete
field instances.

#### Parameters

##### acroFormDict

[`PdfDict`](PdfDict.md)

The /AcroForm dictionary from the document catalog.

##### resolver

[`RefResolver`](../type-aliases/RefResolver.md)

Function to resolve PdfRef to PdfObject.

#### Returns

`PdfForm`
