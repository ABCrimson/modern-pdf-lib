[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildEmbeddedFilesNameTree

# Function: buildEmbeddedFilesNameTree()

```ts
function buildEmbeddedFilesNameTree(
   files, 
   names, 
   _registry): PdfDict;
```

Defined in: [src/core/embeddedFiles.ts:243](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L243)

Build an `/EmbeddedFiles` name tree dictionary.

## Parameters

### files

[`PdfRef`](../classes/PdfRef.md)[]

Array of indirect references to filespec dictionaries.

### names

`string`[]

Corresponding file names (same order as `files`).

### \_registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

## Returns

[`PdfDict`](../classes/PdfDict.md)

The name tree dictionary.
