[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfString

# Class: PdfString

Defined in: [src/core/pdfObjects.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L128)

A PDF string — either literal `(…)` or hexadecimal `<…>`.

By default the constructor produces a literal string.  Use the static
helpers for explicit control.

## Properties

### hex

> `readonly` **hex**: `boolean`

Defined in: [src/core/pdfObjects.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L136)

When `true` the string is serialized in hexadecimal form `<…>`.

***

### value

> `readonly` **value**: `string`

Defined in: [src/core/pdfObjects.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L134)

The raw string content (unescaped).

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L154)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### hex()

> `static` **hex**(`value`): `PdfString`

Defined in: [src/core/pdfObjects.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L145)

Create a hexadecimal string `<…>` from a plain string.

#### Parameters

##### value

`string`

#### Returns

`PdfString`

***

### hexFromBytes()

> `static` **hexFromBytes**(`data`): `PdfString`

Defined in: [src/core/pdfObjects.ts:150](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L150)

Create a hexadecimal string from raw bytes.

#### Parameters

##### data

`Uint8Array`

#### Returns

`PdfString`

***

### literal()

> `static` **literal**(`value`): `PdfString`

Defined in: [src/core/pdfObjects.ts:140](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L140)

Create a literal string `(…)`.

#### Parameters

##### value

`string`

#### Returns

`PdfString`
