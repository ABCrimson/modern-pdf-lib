[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / attachFile

# Function: attachFile()

```ts
function attachFile(registry, file): PdfRef;
```

Defined in: [src/core/embeddedFiles.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/embeddedFiles.ts#L58)

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
