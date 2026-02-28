[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginLayerContent

# Function: beginLayerContent()

> **beginLayerContent**(`layer`): `string`

Defined in: [src/layers/optionalContent.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/layers/optionalContent.ts#L292)

Generate the PDF operator to begin optional content for a layer.

This produces a `BDC` (begin marked-content with properties)
operator that activates the given layer.

## Parameters

### layer

[`PdfLayer`](../classes/PdfLayer.md)

The layer to activate.

## Returns

`string`

The PDF operator string: `/OC /LayerName BDC\n`
