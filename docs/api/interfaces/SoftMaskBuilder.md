[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SoftMaskBuilder

# Interface: SoftMaskBuilder

Defined in: [src/core/pdfPage.ts:571](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfPage.ts#L571)

Builder interface for constructing soft mask content.

All drawing is in grayscale: `1` = fully opaque, `0` = fully transparent.

## Methods

### drawCircle()

> **drawCircle**(`cx`, `cy`, `radius`, `gray`): `void`

Defined in: [src/core/pdfPage.ts:581](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfPage.ts#L581)

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

Defined in: [src/core/pdfPage.ts:576](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfPage.ts#L576)

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

Defined in: [src/core/pdfPage.ts:585](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfPage.ts#L585)

Append raw PDF content-stream operators to the mask.

#### Parameters

##### ops

`string`

#### Returns

`void`
