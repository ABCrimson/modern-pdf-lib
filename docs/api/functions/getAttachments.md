[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getAttachments

# Function: getAttachments()

```ts
function getAttachments(catalogDict, resolver): EmbeddedFile[];
```

Defined in: [src/core/embeddedFiles.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/embeddedFiles.ts#L116)

Extract embedded file attachments from a catalog dictionary.

## Parameters

### catalogDict

[`PdfDict`](../classes/PdfDict.md)

The catalog dictionary.

### resolver

(`ref`) =&gt; [`PdfObject`](../type-aliases/PdfObject.md)

A function to resolve indirect references.

## Returns

[`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

An array of embedded file descriptions.
