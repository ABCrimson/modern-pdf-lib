[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfString

# Class: PdfString

Defined in: [src/core/pdfObjects.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L138)

A PDF string — either literal `(…)` or hexadecimal `<…>`.

By default the constructor produces a literal string.  Use the static
helpers for explicit control.

## Properties

### hex

> `readonly` **hex**: `boolean`

Defined in: [src/core/pdfObjects.ts:146](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L146)

When `true` the string is serialized in hexadecimal form `<…>`.

***

### value

> `readonly` **value**: `string`

Defined in: [src/core/pdfObjects.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L144)

The raw string content (unescaped).

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L164)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### hex()

> `static` **hex**(`value`): `PdfString`

Defined in: [src/core/pdfObjects.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L155)

Create a hexadecimal string `<…>` from a plain string.

#### Parameters

##### value

`string`

#### Returns

`PdfString`

***

### hexFromBytes()

> `static` **hexFromBytes**(`data`): `PdfString`

Defined in: [src/core/pdfObjects.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L160)

Create a hexadecimal string from raw bytes.

#### Parameters

##### data

`Uint8Array`

#### Returns

`PdfString`

***

### literal()

> `static` **literal**(`value`): `PdfString`

Defined in: [src/core/pdfObjects.ts:150](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L150)

Create a literal string `(…)`.

#### Parameters

##### value

`string`

#### Returns

`PdfString`
