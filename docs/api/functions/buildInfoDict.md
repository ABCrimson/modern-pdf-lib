[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildInfoDict

# Function: buildInfoDict()

```ts
function buildInfoDict(meta, registry): PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfCatalog.ts#L73)

Build the `/Info` dictionary from metadata.

## Parameters

### meta

[`DocumentMetadata`](../interfaces/DocumentMetadata.md)

Document metadata.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry — the info dict is registered as an
                 indirect object.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the `/Info` dict.
