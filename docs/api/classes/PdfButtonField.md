[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfButtonField

# Class: PdfButtonField

Defined in: [src/form/fields/buttonField.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L44)

A PDF pushbutton field (/FT /Btn with Pushbutton flag).

Pushbuttons have no permanent value. They may have an associated
action (e.g. JavaScript, submit form, reset form) and display a
caption via the /MK dictionary.

## Extends

- [`PdfField`](PdfField.md)

## Constructors

### Constructor

> **new PdfButtonField**(`name`, `dict`, `widgetDict`, `parentNames?`): `PdfButtonField`

Defined in: [src/form/pdfField.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L175)

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

Defined in: [src/form/pdfField.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L164)

The underlying field dictionary (may contain both field and widget
entries for simple one-widget fields).

#### Inherited from

[`PdfField`](PdfField.md).[`dict`](PdfField.md#dict)

***

### fieldType

> `readonly` **fieldType**: [`FieldType`](../type-aliases/FieldType.md) = `'button'`

Defined in: [src/form/fields/buttonField.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L45)

Discriminator for the concrete field type.

#### Overrides

[`PdfField`](PdfField.md).[`fieldType`](PdfField.md#fieldtype)

***

### name

> `readonly` **name**: `string`

Defined in: [src/form/pdfField.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L158)

The fully-qualified field name.

#### Inherited from

[`PdfField`](PdfField.md).[`name`](PdfField.md#name)

***

### parentNames

> `protected` `readonly` **parentNames**: `string`[]

Defined in: [src/form/pdfField.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L173)

Parent field dictionary chain for building full names.

#### Inherited from

[`PdfField`](PdfField.md).[`parentNames`](PdfField.md#parentnames)

***

### widgetDict

> `protected` `readonly` **widgetDict**: [`PdfDict`](PdfDict.md)

Defined in: [src/form/pdfField.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L170)

The widget annotation dictionary. For merged field+widget dicts,
this is the same object as `dict`.

#### Inherited from

[`PdfField`](PdfField.md).[`widgetDict`](PdfField.md#widgetdict)

## Methods

### addToPage()

> **addToPage**(`page`): `void`

Defined in: [src/form/pdfField.ts:309](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L309)

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

Defined in: [src/form/pdfField.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L271)

Disable exporting this field (set the NoExport flag).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`disableExporting`](PdfField.md#disableexporting)

***

### enableExporting()

> **enableExporting**(): `void`

Defined in: [src/form/pdfField.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L266)

Enable exporting this field (clear the NoExport flag).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`enableExporting`](PdfField.md#enableexporting)

***

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md)

Defined in: [src/form/fields/buttonField.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L145)

Generate the appearance stream for this button.

#### Returns

[`PdfStream`](PdfStream.md)

#### Overrides

[`PdfField`](PdfField.md).[`generateAppearance`](PdfField.md#generateappearance)

***

### getCaption()

> **getCaption**(): `string` \| `undefined`

Defined in: [src/form/fields/buttonField.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L55)

Get the button caption from the /MK dictionary.
Returns undefined if no caption is set.

#### Returns

`string` \| `undefined`

***

### getFieldFlags()

> `protected` **getFieldFlags**(): `number`

Defined in: [src/form/pdfField.ts:211](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L211)

Get the raw /Ff (field flags) integer value.

#### Returns

`number`

#### Inherited from

[`PdfField`](PdfField.md).[`getFieldFlags`](PdfField.md#getfieldflags)

***

### getFullName()

> **getFullName**(): `string`

Defined in: [src/form/pdfField.ts:201](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L201)

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

Defined in: [src/form/pdfField.ts:192](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L192)

Get the partial field name (/T entry).

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getName`](PdfField.md#getname)

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/form/pdfField.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L283)

Get the field's widget rectangle as `[x1, y1, x2, y2]`.
The /Rect entry comes from the widget annotation dictionary.

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfField`](PdfField.md).[`getRect`](PdfField.md#getrect)

***

### getValue()

> **getValue**(): `string`

Defined in: [src/form/fields/buttonField.ts:131](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L131)

Pushbuttons have no value; returns empty string.

#### Returns

`string`

#### Overrides

[`PdfField`](PdfField.md).[`getValue`](PdfField.md#getvalue)

***

### hasFlag()

> `protected` **hasFlag**(`flag`): `boolean`

Defined in: [src/form/pdfField.ts:221](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L221)

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

Defined in: [src/form/pdfField.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L261)

Whether the field is exported (inverse of NoExport flag).

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isExported`](PdfField.md#isexported)

***

### isNoExport()

> **isNoExport**(): `boolean`

Defined in: [src/form/pdfField.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L256)

Whether the field should not be exported.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isNoExport`](PdfField.md#isnoexport)

***

### isReadOnly()

> **isReadOnly**(): `boolean`

Defined in: [src/form/pdfField.ts:236](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L236)

Whether the field is read-only.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isReadOnly`](PdfField.md#isreadonly)

***

### isRequired()

> **isRequired**(): `boolean`

Defined in: [src/form/pdfField.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L246)

Whether the field is required.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isRequired`](PdfField.md#isrequired)

***

### setCaption()

> **setCaption**(`caption`): `void`

Defined in: [src/form/fields/buttonField.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L67)

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

Defined in: [src/form/pdfField.ts:216](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L216)

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

Defined in: [src/form/pdfField.ts:226](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L226)

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

Defined in: [src/form/fields/buttonField.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L90)

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

Defined in: [src/form/pdfField.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L241)

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

Defined in: [src/form/pdfField.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/pdfField.ts#L251)

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

Defined in: [src/form/fields/buttonField.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fields/buttonField.ts#L136)

Pushbuttons have no value; no-op.

#### Parameters

##### \_value

`string` | `boolean` | `string`[]

#### Returns

`void`

#### Overrides

[`PdfField`](PdfField.md).[`setValue`](PdfField.md#setvalue)
