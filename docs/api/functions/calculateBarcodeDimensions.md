[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateBarcodeDimensions

# Function: calculateBarcodeDimensions()

> **calculateBarcodeDimensions**(`matrix`, `options?`): `object`

Defined in: [src/barcode/style.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/barcode/style.ts#L88)

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
