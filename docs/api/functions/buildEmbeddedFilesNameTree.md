[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildEmbeddedFilesNameTree

# Function: buildEmbeddedFilesNameTree()

> **buildEmbeddedFilesNameTree**(`files`, `names`, `registry`): [`PdfDict`](../classes/PdfDict.md)

Defined in: [src/core/embeddedFiles.ts:243](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/embeddedFiles.ts#L243)

Build an `/EmbeddedFiles` name tree dictionary.

## Parameters

### files

[`PdfRef`](../classes/PdfRef.md)[]

Array of indirect references to filespec dictionaries.

### names

`string`[]

Corresponding file names (same order as `files`).

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The PDF object registry.

## Returns

[`PdfDict`](../classes/PdfDict.md)

The name tree dictionary.
