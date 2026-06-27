[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginLayerContent

# Function: beginLayerContent()

```ts
function beginLayerContent(layer): string;
```

Defined in: [src/layers/optionalContent.ts:291](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L291)

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
