[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageRef

# Interface: ImageRef

Defined in: [src/core/pdfPage.ts:537](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L537)

Opaque handle for an image that has been embedded in the document.

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfPage.ts:545](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L545)

Intrinsic height in pixels.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfPage.ts:539](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L539)

Resource name used in content-stream operators (e.g. `Im1`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfPage.ts:541](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L541)

Indirect reference to the image XObject.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfPage.ts:543](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L543)

Intrinsic width in pixels.

## Methods

### scale()

> **scale**(`factor`): `object`

Defined in: [src/core/pdfPage.ts:551](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L551)

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

Defined in: [src/core/pdfPage.ts:559](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L559)

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
