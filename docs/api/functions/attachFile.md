[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / attachFile

# Function: attachFile()

> **attachFile**(`registry`, `file`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/embeddedFiles.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/embeddedFiles.ts#L58)

Create an embedded file stream and filespec dictionary, registering
them in the object registry.

## Parameters

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The PDF object registry.

### file

[`EmbeddedFile`](../interfaces/EmbeddedFile.md)

The file to embed.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the filespec dictionary.
