[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createAssociatedFile

# Function: createAssociatedFile()

```ts
function createAssociatedFile(registry, options): AssociatedFileResult;
```

Defined in: [src/compliance/associatedFiles.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/associatedFiles.ts#L96)

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
