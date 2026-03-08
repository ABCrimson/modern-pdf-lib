[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getAttachments

# Function: getAttachments()

> **getAttachments**(`catalogDict`, `resolver`): [`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

Defined in: [src/core/embeddedFiles.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/embeddedFiles.ts#L116)

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
