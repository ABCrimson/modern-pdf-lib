[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createAssociatedFile

# Function: createAssociatedFile()

> **createAssociatedFile**(`registry`, `options`): [`AssociatedFileResult`](../interfaces/AssociatedFileResult.md)

Defined in: [src/compliance/associatedFiles.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/compliance/associatedFiles.ts#L96)

Create a PDF/A-3 compliant associated file entry.

Creates:
1. An embedded file stream with the data
2. A file specification dictionary with /AFRelationship

The caller is responsible for adding the `fileSpecRef` to the
catalog's /AF array and /Names/EmbeddedFiles name tree.

## Parameters

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The PDF object registry.

### options

[`AssociatedFileOptions`](../interfaces/AssociatedFileOptions.md)

Associated file configuration.

## Returns

[`AssociatedFileResult`](../interfaces/AssociatedFileResult.md)

References to the created objects.
