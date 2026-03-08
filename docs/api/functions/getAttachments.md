[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getAttachments

# Function: getAttachments()

> **getAttachments**(`catalogDict`, `resolver`): [`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

Defined in: [src/core/embeddedFiles.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/embeddedFiles.ts#L116)

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
