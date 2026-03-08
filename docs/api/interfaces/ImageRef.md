[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageRef

# Interface: ImageRef

Defined in: [src/core/pdfPage.ts:507](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L507)

Opaque handle for an image that has been embedded in the document.

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfPage.ts:515](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L515)

Intrinsic height in pixels.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfPage.ts:509](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L509)

Resource name used in content-stream operators (e.g. `Im1`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfPage.ts:511](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L511)

Indirect reference to the image XObject.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfPage.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L513)

Intrinsic width in pixels.

## Methods

### scale()

> **scale**(`factor`): `object`

Defined in: [src/core/pdfPage.ts:521](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L521)

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

Defined in: [src/core/pdfPage.ts:529](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L529)

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
