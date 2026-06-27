[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfField

# Abstract Class: PdfField

Defined in: [src/form/pdfField.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L169)

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

```ts
new PdfField(
   name, 
   dict, 
   widgetDict, 
   parentNames?): PdfField;
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

`PdfField`

## Properties

### dict

```ts
protected readonly dict: PdfDict;
```

Defined in: [src/form/pdfField.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L180)

The underlying field dictionary (may contain both field and widget
entries for simple one-widget fields).

***

### fieldType

```ts
abstract readonly fieldType: FieldType;
```

Defined in: [src/form/pdfField.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L171)

Discriminator for the concrete field type.

***

### name

```ts
readonly name: string;
```

Defined in: [src/form/pdfField.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L174)

The fully-qualified field name.

***

### parentNames

```ts
protected readonly parentNames: string[];
```

Defined in: [src/form/pdfField.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L189)

Parent field dictionary chain for building full names.

***

### widgetDict

```ts
protected readonly widgetDict: PdfDict;
```

Defined in: [src/form/pdfField.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L186)

The widget annotation dictionary. For merged field+widget dicts,
this is the same object as `dict`.

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

***

### disableExporting()

```ts
disableExporting(): void;
```

Defined in: [src/form/pdfField.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L292)

Disable exporting this field (set the NoExport flag).

#### Returns

`void`

***

### enableExporting()

```ts
enableExporting(): void;
```

Defined in: [src/form/pdfField.ts:287](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L287)

Enable exporting this field (clear the NoExport flag).

#### Returns

`void`

***

### generateAppearance()

```ts
abstract generateAppearance(): PdfStream;
```

Defined in: [src/form/pdfField.ts:363](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L363)

Generate the /AP (appearance) stream for this field's current value.
Returns a PdfStream suitable for the /N (normal) appearance.

#### Returns

[`PdfStream`](PdfStream.md)

***

### getDict()

```ts
getDict(): PdfDict;
```

Defined in: [src/form/pdfField.ts:223](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L223)

Return the underlying field dictionary (for internal use by PdfForm).

#### Returns

[`PdfDict`](PdfDict.md)

***

### getFieldFlags()

```ts
protected getFieldFlags(): number;
```

Defined in: [src/form/pdfField.ts:232](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L232)

Get the raw /Ff (field flags) integer value.

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

***

### getName()

```ts
getName(): string;
```

Defined in: [src/form/pdfField.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L208)

Get the partial field name (/T entry).

#### Returns

`string`

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

***

### getValue()

```ts
abstract getValue(): string | boolean | string[];
```

Defined in: [src/form/pdfField.ts:354](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L354)

Get the current value of this field.

#### Returns

`string` \| `boolean` \| `string`[]

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

***

### isExported()

```ts
isExported(): boolean;
```

Defined in: [src/form/pdfField.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L282)

Whether the field is exported (inverse of NoExport flag).

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

***

### isReadOnly()

```ts
isReadOnly(): boolean;
```

Defined in: [src/form/pdfField.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L257)

Whether the field is read-only.

#### Returns

`boolean`

***

### isRequired()

```ts
isRequired(): boolean;
```

Defined in: [src/form/pdfField.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L267)

Whether the field is required.

#### Returns

`boolean`

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

***

### setValue()

```ts
abstract setValue(value): void;
```

Defined in: [src/form/pdfField.ts:357](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/pdfField.ts#L357)

Set the value of this field.

#### Parameters

##### value

`string` \| `boolean` \| `string`[]

#### Returns

`void`
