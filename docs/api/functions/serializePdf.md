[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / serializePdf

# Function: serializePdf()

> **serializePdf**(`registry`, `structure`, `options?`, `encryptionHandler?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/pdfWriter.ts:793](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfWriter.ts#L793)

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

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The raw PDF bytes.
