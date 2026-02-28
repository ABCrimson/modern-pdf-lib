[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfField

# Abstract Class: PdfField

Defined in: [src/form/pdfField.ts:153](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L153)

Abstract base class for all AcroForm field types.

Each field holds a reference to the underlying field dictionary
(which may be a merged field+widget dictionary in simple forms)
and an optional separate widget annotation dictionary.

## Extended by

- [`PdfTextField`](PdfTextField.md)
- [`PdfCheckboxField`](PdfCheckboxField.md)
- [`PdfRadioGroup`](PdfRadioGroup.md)
- [`PdfDropdownField`](PdfDropdownField.md)
- [`PdfListboxField`](PdfListboxField.md)
- [`PdfButtonField`](PdfButtonField.md)
- [`PdfSignatureField`](PdfSignatureField.md)

## Constructors

### Constructor

> **new PdfField**(`name`, `dict`, `widgetDict`, `parentNames?`): `PdfField`

Defined in: [src/form/pdfField.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L175)

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

`PdfField`

## Properties

### dict

> `protected` `readonly` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfField.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L164)

The underlying field dictionary (may contain both field and widget
entries for simple one-widget fields).

***

### fieldType

> `abstract` `readonly` **fieldType**: [`FieldType`](../type-aliases/FieldType.md)

Defined in: [src/form/pdfField.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L155)

Discriminator for the concrete field type.

***

### name

> `readonly` **name**: `string`

Defined in: [src/form/pdfField.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L158)

The fully-qualified field name.

***

### parentNames

> `protected` `readonly` **parentNames**: `string`[]

Defined in: [src/form/pdfField.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L173)

Parent field dictionary chain for building full names.

***

### widgetDict

> `protected` `readonly` **widgetDict**: [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfField.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L170)

The widget annotation dictionary. For merged field+widget dicts,
this is the same object as `dict`.

## Methods

### addToPage()

> **addToPage**(`page`): `void`

Defined in: [src/form/pdfField.ts:309](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L309)

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

***

### disableExporting()

> **disableExporting**(): `void`

Defined in: [src/form/pdfField.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L271)

Disable exporting this field (set the NoExport flag).

#### Returns

`void`

***

### enableExporting()

> **enableExporting**(): `void`

Defined in: [src/form/pdfField.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L266)

Enable exporting this field (clear the NoExport flag).

#### Returns

`void`

***

### generateAppearance()

> `abstract` **generateAppearance**(): [`PdfStream`](PdfStream.md)

Defined in: [src/form/pdfField.ts:342](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L342)

Generate the /AP (appearance) stream for this field's current value.
Returns a PdfStream suitable for the /N (normal) appearance.

#### Returns

[`PdfStream`](PdfStream.md)

***

### getFieldFlags()

> `protected` **getFieldFlags**(): `number`

Defined in: [src/form/pdfField.ts:211](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L211)

Get the raw /Ff (field flags) integer value.

#### Returns

`number`

***

### getFullName()

> **getFullName**(): `string`

Defined in: [src/form/pdfField.ts:201](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L201)

Get the fully qualified field name (Parent.Child.Name format).
Per PDF spec SS12.7.3.2, the full name is formed by concatenating
ancestor /T values with periods.

#### Returns

`string`

***

### getName()

> **getName**(): `string`

Defined in: [src/form/pdfField.ts:192](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L192)

Get the partial field name (/T entry).

#### Returns

`string`

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/form/pdfField.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L283)

Get the field's widget rectangle as `[x1, y1, x2, y2]`.
The /Rect entry comes from the widget annotation dictionary.

#### Returns

\[`number`, `number`, `number`, `number`\]

***

### getValue()

> `abstract` **getValue**(): `string` \| `boolean` \| `string`[]

Defined in: [src/form/pdfField.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L333)

Get the current value of this field.

#### Returns

`string` \| `boolean` \| `string`[]

***

### hasFlag()

> `protected` **hasFlag**(`flag`): `boolean`

Defined in: [src/form/pdfField.ts:221](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L221)

Check if a specific flag bit is set.

#### Parameters

##### flag

`number`

#### Returns

`boolean`

***

### isExported()

> **isExported**(): `boolean`

Defined in: [src/form/pdfField.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L261)

Whether the field is exported (inverse of NoExport flag).

#### Returns

`boolean`

***

### isNoExport()

> **isNoExport**(): `boolean`

Defined in: [src/form/pdfField.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L256)

Whether the field should not be exported.

#### Returns

`boolean`

***

### isReadOnly()

> **isReadOnly**(): `boolean`

Defined in: [src/form/pdfField.ts:236](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L236)

Whether the field is read-only.

#### Returns

`boolean`

***

### isRequired()

> **isRequired**(): `boolean`

Defined in: [src/form/pdfField.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L246)

Whether the field is required.

#### Returns

`boolean`

***

### setFieldFlags()

> `protected` **setFieldFlags**(`flags`): `void`

Defined in: [src/form/pdfField.ts:216](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L216)

Set the raw /Ff (field flags) integer value.

#### Parameters

##### flags

`number`

#### Returns

`void`

***

### setFlag()

> `protected` **setFlag**(`flag`, `on`): `void`

Defined in: [src/form/pdfField.ts:226](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L226)

Set or clear a specific flag bit.

#### Parameters

##### flag

`number`

##### on

`boolean`

#### Returns

`void`

***

### setReadOnly()

> **setReadOnly**(`readOnly`): `void`

Defined in: [src/form/pdfField.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L241)

Set the read-only flag.

#### Parameters

##### readOnly

`boolean`

#### Returns

`void`

***

### setRequired()

> **setRequired**(`required`): `void`

Defined in: [src/form/pdfField.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L251)

Set the required flag.

#### Parameters

##### required

`boolean`

#### Returns

`void`

***

### setValue()

> `abstract` **setValue**(`value`): `void`

Defined in: [src/form/pdfField.ts:336](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/form/pdfField.ts#L336)

Set the value of this field.

#### Parameters

##### value

`string` | `boolean` | `string`[]

#### Returns

`void`
