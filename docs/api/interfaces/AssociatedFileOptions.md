[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AssociatedFileOptions

# Interface: AssociatedFileOptions

Defined in: [src/compliance/associatedFiles.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L53)

Options for creating an associated file entry.

## Properties

### creationDate?

> `readonly` `optional` **creationDate**: `string`

Defined in: [src/compliance/associatedFiles.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L65)

Optional creation date (ISO 8601 string, stored as PDF date).

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/compliance/associatedFiles.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L55)

The file data bytes.

***

### description?

> `readonly` `optional` **description**: `string`

Defined in: [src/compliance/associatedFiles.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L63)

Optional description of the file.

***

### filename

> `readonly` **filename**: `string`

Defined in: [src/compliance/associatedFiles.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L57)

The filename.

***

### mimeType

> `readonly` **mimeType**: `string`

Defined in: [src/compliance/associatedFiles.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L59)

MIME type of the file (e.g. `"text/xml"`, `"application/pdf"`).

***

### modificationDate?

> `readonly` `optional` **modificationDate**: `string`

Defined in: [src/compliance/associatedFiles.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L67)

Optional modification date (ISO 8601 string, stored as PDF date).

***

### relationship

> `readonly` **relationship**: [`AFRelationship`](../type-aliases/AFRelationship.md)

Defined in: [src/compliance/associatedFiles.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/associatedFiles.ts#L61)

Relationship to the PDF document.
