[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageRef

# Interface: ImageRef

Defined in: [src/core/pdfPage.ts:485](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L485)

Opaque handle for an image that has been embedded in the document.

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfPage.ts:493](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L493)

Intrinsic height in pixels.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfPage.ts:487](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L487)

Resource name used in content-stream operators (e.g. `Im1`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfPage.ts:489](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L489)

Indirect reference to the image XObject.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfPage.ts:491](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L491)

Intrinsic width in pixels.

## Methods

### scale()

> **scale**(`factor`): `object`

Defined in: [src/core/pdfPage.ts:499](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L499)

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

Defined in: [src/core/pdfPage.ts:507](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfPage.ts#L507)

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
