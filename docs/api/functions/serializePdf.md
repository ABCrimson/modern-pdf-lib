[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / serializePdf

# Function: serializePdf()

> **serializePdf**(`registry`, `structure`, `options?`): `Uint8Array`

Defined in: [src/core/pdfWriter.ts:670](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfWriter.ts#L670)

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

## Returns

`Uint8Array`

The raw PDF bytes.
