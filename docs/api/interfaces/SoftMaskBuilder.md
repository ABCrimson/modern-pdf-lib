[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SoftMaskBuilder

# Interface: SoftMaskBuilder

Defined in: [src/core/pdfPage.ts:601](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L601)

Builder interface for constructing soft mask content.

All drawing is in grayscale: `1` = fully opaque, `0` = fully transparent.

## Methods

### drawCircle()

> **drawCircle**(`cx`, `cy`, `radius`, `gray`): `void`

Defined in: [src/core/pdfPage.ts:611](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L611)

Draw a filled circle at the given center with the specified radius
and grayscale value.

#### Parameters

##### cx

`number`

##### cy

`number`

##### radius

`number`

##### gray

`number`

#### Returns

`void`

***

### drawRectangle()

> **drawRectangle**(`x`, `y`, `width`, `height`, `gray`): `void`

Defined in: [src/core/pdfPage.ts:606](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L606)

Draw a filled rectangle at the given position with the specified
grayscale value (`0` = black/transparent, `1` = white/opaque).

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

##### gray

`number`

#### Returns

`void`

***

### pushRawOperators()

> **pushRawOperators**(`ops`): `void`

Defined in: [src/core/pdfPage.ts:615](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfPage.ts#L615)

Append raw PDF content-stream operators to the mask.

#### Parameters

##### ops

`string`

#### Returns

`void`
