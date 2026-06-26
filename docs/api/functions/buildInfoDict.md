[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildInfoDict

# Function: buildInfoDict()

```ts
function buildInfoDict(meta, registry): PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L73)

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
