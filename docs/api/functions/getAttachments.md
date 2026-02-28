[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getAttachments

# Function: getAttachments()

> **getAttachments**(`catalogDict`, `resolver`): [`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

Defined in: [src/core/embeddedFiles.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/embeddedFiles.ts#L116)

Extract embedded file attachments from a catalog dictionary.

## Parameters

### catalogDict

[`PdfDict`](../classes/PdfDict.md)

The catalog dictionary.

### resolver

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md)

A function to resolve indirect references.

## Returns

[`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

An array of embedded file descriptions.
