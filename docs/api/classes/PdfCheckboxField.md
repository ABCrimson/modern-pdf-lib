[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfCheckboxField

# Class: PdfCheckboxField

Defined in: [src/form/fields/checkboxField.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L28)

A PDF checkbox form field (/FT /Btn).

The value is either the "on" name (typically "Yes") or "/Off".
The /AS (appearance state) entry controls which appearance is shown.

## Extends

- [`PdfField`](PdfField.md)

## Constructors

### Constructor

```ts
new PdfCheckboxField(
   name, 
   dict, 
   widgetDict, 
   parentNames?): PdfCheckboxField;
```

Defined in: [src/form/pdfField.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L191)

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

`PdfCheckboxField`

#### Inherited from

[`PdfField`](PdfField.md).[`constructor`](PdfField.md#constructor)

## Properties

### dict

```ts
protected readonly dict: PdfDict;
```

Defined in: [src/form/pdfField.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L180)

The underlying field dictionary (may contain both field and widget
entries for simple one-widget fields).

#### Inherited from

[`PdfField`](PdfField.md).[`dict`](PdfField.md#dict)

***

### fieldType

```ts
readonly fieldType: FieldType = 'checkbox';
```

Defined in: [src/form/fields/checkboxField.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L29)

Discriminator for the concrete field type.

#### Overrides

[`PdfField`](PdfField.md).[`fieldType`](PdfField.md#fieldtype)

***

### name

```ts
readonly name: string;
```

Defined in: [src/form/pdfField.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L174)

The fully-qualified field name.

#### Inherited from

[`PdfField`](PdfField.md).[`name`](PdfField.md#name)

***

### parentNames

```ts
protected readonly parentNames: string[];
```

Defined in: [src/form/pdfField.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L189)

Parent field dictionary chain for building full names.

#### Inherited from

[`PdfField`](PdfField.md).[`parentNames`](PdfField.md#parentnames)

***

### widgetDict

```ts
protected readonly widgetDict: PdfDict;
```

Defined in: [src/form/pdfField.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L186)

The widget annotation dictionary. For merged field+widget dicts,
this is the same object as `dict`.

#### Inherited from

[`PdfField`](PdfField.md).[`widgetDict`](PdfField.md#widgetdict)

## Methods

### addToPage()

```ts
addToPage(page): void;
```

Defined in: [src/form/pdfField.ts:330](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L330)

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

### check()

```ts
check(): void;
```

Defined in: [src/form/fields/checkboxField.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L51)

Check the checkbox (set to the "on" value).

#### Returns

`void`

***

### disableExporting()

```ts
disableExporting(): void;
```

Defined in: [src/form/pdfField.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L292)

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

Defined in: [src/form/pdfField.ts:287](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L287)

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

Defined in: [src/form/fields/checkboxField.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L133)

Generate the appearance stream for this checkbox.

#### Returns

[`PdfStream`](PdfStream.md)

#### Overrides

[`PdfField`](PdfField.md).[`generateAppearance`](PdfField.md#generateappearance)

***

### getDict()

```ts
getDict(): PdfDict;
```

Defined in: [src/form/pdfField.ts:223](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L223)

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

Defined in: [src/form/pdfField.ts:232](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L232)

Get the raw /Ff (field flags) integer value.

#### Returns

`number`

#### Inherited from

[`PdfField`](PdfField.md).[`getFieldFlags`](PdfField.md#getfieldflags)

***

### getFullName()

```ts
getFullName(): string;
```

Defined in: [src/form/pdfField.ts:217](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L217)

Get the fully qualified field name (Parent.Child.Name format).
Per PDF spec SS12.7.3.2, the full name is formed by concatenating
ancestor /T values with periods.

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getFullName`](PdfField.md#getfullname)

***

### getName()

```ts
getName(): string;
```

Defined in: [src/form/pdfField.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L208)

Get the partial field name (/T entry).

#### Returns

`string`

#### Inherited from

[`PdfField`](PdfField.md).[`getName`](PdfField.md#getname)

***

### getOnValue()

```ts
getOnValue(): string;
```

Defined in: [src/form/fields/checkboxField.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L80)

Get the "on" value name for this checkbox.

Examines the /AP /N dictionary for a key that is not "/Off".
Falls back to "Yes" if no appearance dictionary is found.

#### Returns

`string`

***

### getRect()

```ts
getRect(): [number, number, number, number];
```

Defined in: [src/form/pdfField.ts:304](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L304)

Get the field's widget rectangle as `[x1, y1, x2, y2]`.
The /Rect entry comes from the widget annotation dictionary.

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfField`](PdfField.md).[`getRect`](PdfField.md#getrect)

***

### getValue()

```ts
getValue(): boolean;
```

Defined in: [src/form/fields/checkboxField.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L106)

Get the value: "Yes"/"Off" as boolean for convenience.

#### Returns

`boolean`

#### Overrides

[`PdfField`](PdfField.md).[`getValue`](PdfField.md#getvalue)

***

### hasFlag()

```ts
protected hasFlag(flag): boolean;
```

Defined in: [src/form/pdfField.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L242)

Check if a specific flag bit is set.

#### Parameters

##### flag

`number`

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`hasFlag`](PdfField.md#hasflag)

***

### isChecked()

```ts
isChecked(): boolean;
```

Defined in: [src/form/fields/checkboxField.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L40)

Check whether the checkbox is currently checked.

The checkbox is checked when /V or /AS is not "/Off".

#### Returns

`boolean`

***

### isExported()

```ts
isExported(): boolean;
```

Defined in: [src/form/pdfField.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L282)

Whether the field is exported (inverse of NoExport flag).

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isExported`](PdfField.md#isexported)

***

### isNoExport()

```ts
isNoExport(): boolean;
```

Defined in: [src/form/pdfField.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L277)

Whether the field should not be exported.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isNoExport`](PdfField.md#isnoexport)

***

### isReadOnly()

```ts
isReadOnly(): boolean;
```

Defined in: [src/form/pdfField.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L257)

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

Defined in: [src/form/pdfField.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L267)

Whether the field is required.

#### Returns

`boolean`

#### Inherited from

[`PdfField`](PdfField.md).[`isRequired`](PdfField.md#isrequired)

***

### setFieldFlags()

```ts
protected setFieldFlags(flags): void;
```

Defined in: [src/form/pdfField.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L237)

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

Defined in: [src/form/pdfField.ts:247](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L247)

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

### setReadOnly()

```ts
setReadOnly(readOnly): void;
```

Defined in: [src/form/pdfField.ts:262](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L262)

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

Defined in: [src/form/pdfField.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L272)

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

```ts
setValue(value): void;
```

Defined in: [src/form/fields/checkboxField.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L111)

Set the value as boolean.

#### Parameters

##### value

`string` \| `boolean` \| `string`[]

#### Returns

`void`

#### Overrides

[`PdfField`](PdfField.md).[`setValue`](PdfField.md#setvalue)

***

### toggle()

```ts
toggle(): void;
```

Defined in: [src/form/fields/checkboxField.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L66)

Toggle the checkbox.

#### Returns

`void`

***

### uncheck()

```ts
uncheck(): void;
```

Defined in: [src/form/fields/checkboxField.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fields/checkboxField.ts#L59)

Uncheck the checkbox (set to /Off).

#### Returns

`void`
