[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / serializePdf

# Function: serializePdf()

```ts
function serializePdf(
   registry, 
   structure, 
   options?, 
encryptionHandler?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/pdfWriter.ts:793](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfWriter.ts#L793)

Serialize a complete PDF from a registry and structure refs.

## Parameters

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

All registered indirect objects.

### structure

[`DocumentStructure`](../interfaces/DocumentStructure.md)

Catalog / Info / Pages references.

### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Save options.

### encryptionHandler?

[`PdfEncryptionHandler`](../classes/PdfEncryptionHandler.md)

Optional encryption handler for encrypting
                           all objects and adding /Encrypt + /ID to
                           the trailer.

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The raw PDF bytes.
