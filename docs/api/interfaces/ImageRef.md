[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageRef

# Interface: ImageRef

Defined in: [src/core/pdfPage.ts:478](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L478)

Opaque handle for an image that has been embedded in the document.

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfPage.ts:486](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L486)

Intrinsic height in pixels.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfPage.ts:480](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L480)

Resource name used in content-stream operators (e.g. `Im1`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfPage.ts:482](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L482)

Indirect reference to the image XObject.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfPage.ts:484](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L484)

Intrinsic width in pixels.

## Methods

### scale()

> **scale**(`factor`): `object`

Defined in: [src/core/pdfPage.ts:492](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L492)

Return a new `{ width, height }` scaled by the given factor.

#### Parameters

##### factor

`number`

Scale multiplier (e.g. `0.5` for half size).

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`

***

### scaleToFit()

> **scaleToFit**(`maxWidth`, `maxHeight`): `object`

Defined in: [src/core/pdfPage.ts:500](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfPage.ts#L500)

Return a new `{ width, height }` that fits within the given bounds
while preserving the aspect ratio.

#### Parameters

##### maxWidth

`number`

Maximum allowed width.

##### maxHeight

`number`

Maximum allowed height.

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`
