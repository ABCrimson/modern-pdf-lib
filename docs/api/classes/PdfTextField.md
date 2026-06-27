[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfTextField

# Class: PdfTextField

Defined in: [src/form/fields/textField.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L43)

A PDF text form field (/FT /Tx).

Stores a string value and supports properties like alignment,
multiline mode, password masking, and maximum length.

## Extends

- [`PdfField`](PdfField.md)

## Constructors

### Constructor

```ts
new PdfTextField(
   name, 
   dict, 
   widgetDict, 
   parentNames?): PdfTextField;
```

Defined in: [src/form/pdfField.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L191)

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

`PdfTextField`

#### Inherited from

[`PdfField`](PdfField.md).[`constructor`](PdfField.md#constructor)

## Properties

### dict

```ts
protected readonly dict: PdfDict;
```

Defined in: [src/form/pdfField.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L180)

The underlying field dictionary (may contain both field and widget
entries for simple one-widget fields).

#### Inherited from

[`PdfField`](PdfField.md).[`dict`](PdfField.md#dict)

***

### fieldType

```ts
readonly fieldType: FieldType = 'text';
```

Defined in: [src/form/fields/textField.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L44)

Discriminator for the concrete field type.

#### Overrides

[`PdfField`](PdfField.md).[`fieldType`](PdfField.md#fieldtype)

***

### name

```ts
readonly name: string;
```

Defined in: [src/form/pdfField.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L174)

The fully-qualified field name.

#### Inherited from

[`PdfField`](PdfField.md).[`name`](PdfField.md#name)

***

### parentNames

```ts
protected readonly parentNames: string[];
```

Defined in: [src/form/pdfField.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L189)

Parent field dictionary chain for building full names.

#### Inherited from

[`PdfField`](PdfField.md).[`parentNames`](PdfField.md#parentnames)

***

### widgetDict

```ts
protected readonly widgetDict: PdfDict;
```

Defined in: [src/form/pdfField.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L186)

The widget annotation dictionary. For merged field+widget dicts,
this is the same object as `dict`.

#### Inherited from

[`PdfField`](PdfField.md).[`widgetDict`](PdfField.md#widgetdict)

## Methods

### addToPage()

```ts
addToPage(page): void;
```

Defined in: [src/form/pdfField.ts:330](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L330)

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

```ts
disableExporting(): void;
```

Defined in: [src/form/pdfField.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L292)

Disable exporting this field (set the NoExport flag).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`disableExporting`](PdfField.md#disableexporting)

***

### enableExporting()

```ts
enableExporting(): void;
```

Defined in: [src/form/pdfField.ts:287](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L287)

Enable exporting this field (clear the NoExport flag).

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`enableExporting`](PdfField.md#enableexporting)

***

### generateAppearance()

```ts
generateAppearance(): PdfStream;
```

Defined in: [src/form/fields/textField.ts:229](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L229)

Generate the appearance stream for this text field.

#### Returns

[`PdfStream`](PdfStream.md)

#### Overrides

[`PdfField`](PdfField.md).[`generateAppearance`](PdfField.md#generateappearance)

***

### getAlignment()

```ts
getAlignment(): "left" | "center" | "right";
```

Defined in: [src/form/fields/textField.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L123)

Get the text alignment.
/Q: 0 = left, 1 = center, 2 = right.

#### Returns

`"left"` \| `"center"` \| `"right"`

***

### getDict()

```ts
getDict(): PdfDict;
```

Defined in: [src/form/pdfField.ts:223](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L223)

Return the underlying field dictionary (for internal use by PdfForm).

#### Returns

[`PdfDict`](PdfDict.md)

#### Inherited from

[`PdfField`](PdfField.md).[`getDict`](PdfField.md#getdict)

***

### getFieldFlags()

```ts
protected getFieldFlags(): number;
```

Defined in: [src/form/pdfField.ts:232](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L232)

Get the raw /Ff (field flags) integer value.

#### Returns

`number`

#### Inherited from

[`PdfField`](PdfField.md).[`getFieldFlags`](PdfField.md#getfieldflags)

***

### getFontName()

```ts
getFontName(): string;
```

Defined in: [src/form/fields/textField.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L108)

Get the font name from the /DA string.
Returns "Helv" (Helvetica) as default.

#### Returns

`string`

***

### getFontSize()

```ts
getFontSize(): number;
```

Defined in: [src/form/fields/textField.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L83)

Get the font size from the /DA (default appearance) string.
Returns 0 if the font size is not specified or is auto.

#### Returns

`number`

***

### getFullName()

```ts
getFullName(): string;
```

Defined in: [src/form/pdfField.ts:217](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L217)

Get the fully qualified field name (Parent.Child.Name format).
Per PDF spec SS12.7.3.2, the full name is formed by concatenating
ancestor /T values with periods.

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getFullName`](PdfField.md#getfullname)

***

### getMaxLength()

```ts
getMaxLength(): number | undefined;
```

Defined in: [src/form/fields/textField.ts:166](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L166)

Get the maximum length, or undefined if no limit.

#### Returns

`number` \| `undefined`

***

### getName()

```ts
getName(): string;
```

Defined in: [src/form/pdfField.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L208)

Get the partial field name (/T entry).

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getName`](PdfField.md#getname)

***

### getRect()

```ts
getRect(): [number, number, number, number];
```

Defined in: [src/form/pdfField.ts:304](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L304)

Get the field's widget rectangle as `[x1, y1, x2, y2]`.
The /Rect entry comes from the widget annotation dictionary.

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfField`](PdfField.md).[`getRect`](PdfField.md#getrect)

***

### getText()

```ts
getText(): string;
```

Defined in: [src/form/fields/textField.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L51)

Get the text value of this field.

#### Returns

`string`

***

### getValue()

```ts
getValue(): string;
```

Defined in: [src/form/fields/textField.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L66)

Alias for getText().

#### Returns

`string`

#### Overrides

[`PdfField`](PdfField.md).[`getValue`](PdfField.md#getvalue)

***

### hasFlag()

```ts
protected hasFlag(flag): boolean;
```

Defined in: [src/form/pdfField.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L242)

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

```ts
isExported(): boolean;
```

Defined in: [src/form/pdfField.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L282)

Whether the field is exported (inverse of NoExport flag).

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isExported`](PdfField.md#isexported)

***

### isMultiline()

```ts
isMultiline(): boolean;
```

Defined in: [src/form/fields/textField.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L147)

Whether this is a multiline text field.

#### Returns

`boolean`

***

### isNoExport()

```ts
isNoExport(): boolean;
```

Defined in: [src/form/pdfField.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L277)

Whether the field should not be exported.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isNoExport`](PdfField.md#isnoexport)

***

### isPassword()

```ts
isPassword(): boolean;
```

Defined in: [src/form/fields/textField.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L157)

Whether this is a password field.

#### Returns

`boolean`

***

### isReadOnly()

```ts
isReadOnly(): boolean;
```

Defined in: [src/form/pdfField.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L257)

Whether the field is read-only.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isReadOnly`](PdfField.md#isreadonly)

***

### isRequired()

```ts
isRequired(): boolean;
```

Defined in: [src/form/pdfField.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L267)

Whether the field is required.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isRequired`](PdfField.md#isrequired)

***

### setAlignment()

```ts
setAlignment(align): void;
```

Defined in: [src/form/fields/textField.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L136)

Set the text alignment.

#### Parameters

##### align

`"left"` \| `"center"` \| `"right"`

#### Returns

`void`

***

### setFieldFlags()

```ts
protected setFieldFlags(flags): void;
```

Defined in: [src/form/pdfField.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L237)

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

```ts
protected setFlag(flag, on): void;
```

Defined in: [src/form/pdfField.ts:247](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L247)

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

### setFontSize()

```ts
setFontSize(size): void;
```

Defined in: [src/form/fields/textField.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L98)

Set the font size in the /DA string.
Creates or updates the /DA entry.

#### Parameters

##### size

`number`

#### Returns

`void`

***

### setImage()

```ts
setImage(imageRef): void;
```

Defined in: [src/form/fields/textField.ts:188](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L188)

Set an image on this text field.

Creates an appearance stream that paints the image XObject scaled
to fit the widget rectangle. This replaces the text appearance.

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

### setMaxLength()

```ts
setMaxLength(maxLength): void;
```

Defined in: [src/form/fields/textField.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L171)

Set the maximum length.

#### Parameters

##### maxLength

`number`

#### Returns

`void`

***

### setMultiline()

```ts
setMultiline(multiline): void;
```

Defined in: [src/form/fields/textField.ts:152](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L152)

Set the multiline flag.

#### Parameters

##### multiline

`boolean`

#### Returns

`void`

***

### setReadOnly()

```ts
setReadOnly(readOnly): void;
```

Defined in: [src/form/pdfField.ts:262](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L262)

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

```ts
setRequired(required): void;
```

Defined in: [src/form/pdfField.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L272)

Set the required flag.

#### Parameters

##### required

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfField`](PdfField.md).[`setRequired`](PdfField.md#setrequired)

***

### setText()

```ts
setText(value): void;
```

Defined in: [src/form/fields/textField.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L59)

Set the text value of this field.
Also updates /V and removes /AP to force regeneration.

#### Parameters

##### value

`string`

#### Returns

`void`

***

### setValue()

```ts
setValue(value): void;
```

Defined in: [src/form/fields/textField.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fields/textField.ts#L71)

Alias for setText().

#### Parameters

##### value

`string` \| `boolean` \| `string`[]

#### Returns

`void`

#### Overrides

[`PdfField`](PdfField.md).[`setValue`](PdfField.md#setvalue)
