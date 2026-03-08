[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateBarcodeDimensions

# Function: calculateBarcodeDimensions()

> **calculateBarcodeDimensions**(`matrix`, `options?`): `object`

Defined in: [src/barcode/style.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/barcode/style.ts#L95)

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
