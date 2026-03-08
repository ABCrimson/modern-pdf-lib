[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateBarcodeDimensions

# Function: calculateBarcodeDimensions()

> **calculateBarcodeDimensions**(`matrix`, `options?`): `object`

Defined in: [src/barcode/style.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/style.ts#L95)

Calculate the total dimensions of a styled barcode.

Returns the outer bounding box including quiet zones, padding,
borders, and optional text area.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

The encoded barcode matrix.

### options?

[`StyledBarcodeOptions`](../interfaces/StyledBarcodeOptions.md)

Styling options.

## Returns

`object`

`{ width, height }` in points.

### height

> **height**: `number`

### width

> **width**: `number`
