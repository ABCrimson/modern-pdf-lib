[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / attachFile

# Function: attachFile()

> **attachFile**(`registry`, `file`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/embeddedFiles.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/embeddedFiles.ts#L58)

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
