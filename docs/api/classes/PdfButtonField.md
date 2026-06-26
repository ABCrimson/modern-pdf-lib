[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfButtonField

# Class: PdfButtonField

Defined in: [src/form/fields/buttonField.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L43)

A PDF pushbutton field (/FT /Btn with Pushbutton flag).

Pushbuttons have no permanent value. They may have an associated
action (e.g. JavaScript, submit form, reset form) and display a
caption via the /MK dictionary.

## Extends

- [`PdfField`](PdfField.md)

## Constructors

### Constructor

> **new PdfButtonField**(`name`, `dict`, `widgetDict`, `parentNames?`): `PdfButtonField`

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

`PdfButtonField`

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

> `readonly` **fieldType**: [`FieldType`](../type-aliases/FieldType.md) = `'button'`

Defined in: [src/form/fields/buttonField.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L44)

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

Defined in: [src/form/fields/buttonField.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L144)

Generate the appearance stream for this button.

#### Returns

[`PdfStream`](PdfStream.md)

#### Overrides

[`PdfField`](PdfField.md).[`generateAppearance`](PdfField.md#generateappearance)

***

### getCaption()

> **getCaption**(): `string` \| `undefined`

Defined in: [src/form/fields/buttonField.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L54)

Get the button caption from the /MK dictionary.
Returns undefined if no caption is set.

#### Returns

`string` \| `undefined`

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

### getValue()

> **getValue**(): `string`

Defined in: [src/form/fields/buttonField.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L130)

Pushbuttons have no value; returns empty string.

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

### setCaption()

> **setCaption**(`caption`): `void`

Defined in: [src/form/fields/buttonField.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L66)

Set the button caption in the /MK dictionary.
Creates the /MK dictionary if it does not exist.

#### Parameters

##### caption

`string`

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

### setImage()

> **setImage**(`imageRef`): `void`

Defined in: [src/form/fields/buttonField.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L89)

Set an image on this button field.

Creates an appearance stream that paints the image XObject scaled
to fit the widget rectangle.

#### Parameters

##### imageRef

An object with `name` (resource name) and `ref` (PdfRef)
                 pointing to the image XObject, plus `width` and `height`.

###### height

`number`

###### name

`string`

###### ref

[`PdfRef`](PdfRef.md)

###### width

`number`

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

> **setValue**(`_value`): `void`

Defined in: [src/form/fields/buttonField.ts:135](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fields/buttonField.ts#L135)

Pushbuttons have no value; no-op.

#### Parameters

##### \_value

`string` \| `boolean` \| `string`[]

#### Returns

`void`

#### Overrides

[`PdfField`](PdfField.md).[`setValue`](PdfField.md#setvalue)
