[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildEmbeddedFilesNameTree

# Function: buildEmbeddedFilesNameTree()

> **buildEmbeddedFilesNameTree**(`files`, `names`, `registry`): [`PdfDict`](../classes/PdfDict.md)

Defined in: [src/core/embeddedFiles.ts:243](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/embeddedFiles.ts#L243)

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
