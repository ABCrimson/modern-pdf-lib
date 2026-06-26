[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDropdownField

# Class: PdfDropdownField

Defined in: [src/form/fields/dropdownField.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L28)

A PDF dropdown (combo box) field (/FT /Ch with Combo flag).

Options are stored in the /Opt array. The selected value is in /V.
Optionally editable (bit 18 of /Ff).

## Extends

- [`PdfField`](PdfField.md)

## Constructors

### Constructor

> **new PdfDropdownField**(`name`, `dict`, `widgetDict`, `parentNames?`): `PdfDropdownField`

Defined in: [src/form/pdfField.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L191)

#### Parameters

##### name

`string`

##### dict

[`PdfDict`](PdfDict.md)

##### widgetDict

[`PdfDict`](PdfDict.md)

##### parentNames?

`string`[] = `[]`

#### Returns

`PdfDropdownField`

#### Inherited from

[`PdfField`](PdfField.md).[`constructor`](PdfField.md#constructor)

## Properties

### dict

> `protected` `readonly` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfField.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L180)

The underlying field dictionary (may contain both field and widget
entries for simple one-widget fields).

#### Inherited from

[`PdfField`](PdfField.md).[`dict`](PdfField.md#dict)

***

### fieldType

> `readonly` **fieldType**: [`FieldType`](../type-aliases/FieldType.md) = `'dropdown'`

Defined in: [src/form/fields/dropdownField.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L29)

Discriminator for the concrete field type.

#### Overrides

[`PdfField`](PdfField.md).[`fieldType`](PdfField.md#fieldtype)

***

### name

> `readonly` **name**: `string`

Defined in: [src/form/pdfField.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L174)

The fully-qualified field name.

#### Inherited from

[`PdfField`](PdfField.md).[`name`](PdfField.md#name)

***

### parentNames

> `protected` `readonly` **parentNames**: `string`[]

Defined in: [src/form/pdfField.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L189)

Parent field dictionary chain for building full names.

#### Inherited from

[`PdfField`](PdfField.md).[`parentNames`](PdfField.md#parentnames)

***

### widgetDict

> `protected` `readonly` **widgetDict**: [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfField.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L186)

The widget annotation dictionary. For merged field+widget dicts,
this is the same object as `dict`.

#### Inherited from

[`PdfField`](PdfField.md).[`widgetDict`](PdfField.md#widgetdict)

## Methods

### addToPage()

> **addToPage**(`page`): `void`

Defined in: [src/form/pdfField.ts:330](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L330)

Add this field's widget annotation to a page.

Ensures the widget dict has `/Type /Annot` and `/Subtype /Widget`,
then adds it to the page's annotation list so it appears in the
rendered PDF.

#### Parameters

##### page

[`WidgetAnnotationHost`](../interfaces/WidgetAnnotationHost.md)

A page that implements [WidgetAnnotationHost](../interfaces/WidgetAnnotationHost.md).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`addToPage`](PdfField.md#addtopage)

***

### disableExporting()

> **disableExporting**(): `void`

Defined in: [src/form/pdfField.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L292)

Disable exporting this field (set the NoExport flag).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`disableExporting`](PdfField.md#disableexporting)

***

### enableExporting()

> **enableExporting**(): `void`

Defined in: [src/form/pdfField.ts:287](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L287)

Enable exporting this field (clear the NoExport flag).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`enableExporting`](PdfField.md#enableexporting)

***

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md)

Defined in: [src/form/fields/dropdownField.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L116)

Generate the appearance stream for this dropdown.

#### Returns

[`PdfStream`](PdfStream.md)

#### Overrides

[`PdfField`](PdfField.md).[`generateAppearance`](PdfField.md#generateappearance)

***

### getDict()

> **getDict**(): [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfField.ts:223](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L223)

Return the underlying field dictionary (for internal use by PdfForm).

#### Returns

[`PdfDict`](PdfDict.md)

#### Inherited from

[`PdfField`](PdfField.md).[`getDict`](PdfField.md#getdict)

***

### getFieldFlags()

> `protected` **getFieldFlags**(): `number`

Defined in: [src/form/pdfField.ts:232](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L232)

Get the raw /Ff (field flags) integer value.

#### Returns

`number`

#### Inherited from

[`PdfField`](PdfField.md).[`getFieldFlags`](PdfField.md#getfieldflags)

***

### getFullName()

> **getFullName**(): `string`

Defined in: [src/form/pdfField.ts:217](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L217)

Get the fully qualified field name (Parent.Child.Name format).
Per PDF spec SS12.7.3.2, the full name is formed by concatenating
ancestor /T values with periods.

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getFullName`](PdfField.md#getfullname)

***

### getName()

> **getName**(): `string`

Defined in: [src/form/pdfField.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L208)

Get the partial field name (/T entry).

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getName`](PdfField.md#getname)

***

### getOptions()

> **getOptions**(): `string`[]

Defined in: [src/form/fields/dropdownField.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L67)

Get the list of options.

/Opt may be an array of strings, or an array of two-element arrays
where element [0] is the export value and element [1] is the display
value. We return the display values (or export values if no display).

#### Returns

`string`[]

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/form/pdfField.ts:304](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L304)

Get the field's widget rectangle as `[x1, y1, x2, y2]`.
The /Rect entry comes from the widget annotation dictionary.

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfField`](PdfField.md).[`getRect`](PdfField.md#getrect)

***

### getSelected()

> **getSelected**(): `string`

Defined in: [src/form/fields/dropdownField.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L36)

Get the currently selected value.

#### Returns

`string`

***

### getValue()

> **getValue**(): `string`

Defined in: [src/form/fields/dropdownField.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L47)

Alias for getSelected().

#### Returns

`string`

#### Overrides

[`PdfField`](PdfField.md).[`getValue`](PdfField.md#getvalue)

***

### hasFlag()

> `protected` **hasFlag**(`flag`): `boolean`

Defined in: [src/form/pdfField.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L242)

Check if a specific flag bit is set.

#### Parameters

##### flag

`number`

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`hasFlag`](PdfField.md#hasflag)

***

### isEditable()

> **isEditable**(): `boolean`

Defined in: [src/form/fields/dropdownField.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L102)

Whether the dropdown allows manual text entry.

#### Returns

`boolean`

***

### isExported()

> **isExported**(): `boolean`

Defined in: [src/form/pdfField.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L282)

Whether the field is exported (inverse of NoExport flag).

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isExported`](PdfField.md#isexported)

***

### isNoExport()

> **isNoExport**(): `boolean`

Defined in: [src/form/pdfField.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L277)

Whether the field should not be exported.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isNoExport`](PdfField.md#isnoexport)

***

### isReadOnly()

> **isReadOnly**(): `boolean`

Defined in: [src/form/pdfField.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L257)

Whether the field is read-only.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isReadOnly`](PdfField.md#isreadonly)

***

### isRequired()

> **isRequired**(): `boolean`

Defined in: [src/form/pdfField.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L267)

Whether the field is required.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isRequired`](PdfField.md#isrequired)

***

### select()

> **select**(`value`): `void`

Defined in: [src/form/fields/dropdownField.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L41)

Select a value from the options.

#### Parameters

##### value

`string`

#### Returns

`void`

***

### setEditable()

> **setEditable**(`editable`): `void`

Defined in: [src/form/fields/dropdownField.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L107)

Set whether the dropdown allows manual text entry.

#### Parameters

##### editable

`boolean`

#### Returns

`void`

***

### setFieldFlags()

> `protected` **setFieldFlags**(`flags`): `void`

Defined in: [src/form/pdfField.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L237)

Set the raw /Ff (field flags) integer value.

#### Parameters

##### flags

`number`

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`setFieldFlags`](PdfField.md#setfieldflags)

***

### setFlag()

> `protected` **setFlag**(`flag`, `on`): `void`

Defined in: [src/form/pdfField.ts:247](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L247)

Set or clear a specific flag bit.

#### Parameters

##### flag

`number`

##### on

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`setFlag`](PdfField.md#setflag)

***

### setOptions()

> **setOptions**(`options`): `void`

Defined in: [src/form/fields/dropdownField.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L91)

Set the list of options.

#### Parameters

##### options

`string`[]

#### Returns

`void`

***

### setReadOnly()

> **setReadOnly**(`readOnly`): `void`

Defined in: [src/form/pdfField.ts:262](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L262)

Set the read-only flag.

#### Parameters

##### readOnly

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`setReadOnly`](PdfField.md#setreadonly)

***

### setRequired()

> **setRequired**(`required`): `void`

Defined in: [src/form/pdfField.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfField.ts#L272)

Set the required flag.

#### Parameters

##### required

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`setRequired`](PdfField.md#setrequired)

***

### setValue()

> **setValue**(`value`): `void`

Defined in: [src/form/fields/dropdownField.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/dropdownField.ts#L52)

Alias for select().

#### Parameters

##### value

`string` \| `boolean` \| `string`[]

#### Returns

`void`

#### Overrides

[`PdfField`](PdfField.md).[`setValue`](PdfField.md#setvalue)
