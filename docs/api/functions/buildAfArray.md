[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildAfArray

# Function: buildAfArray()

```ts
function buildAfArray(fileSpecRefs): PdfArray;
```

Defined in: [src/compliance/associatedFiles.ts:151](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/associatedFiles.ts#L151)

Build an /AF array from multiple associated file specification references.

The returned array should be set on the catalog dictionary:
```ts
catalogDict.set('/AF', buildAfArray([ref1, ref2]));
```

## Parameters

### fileSpecRefs

[`PdfRef`](../classes/PdfRef.md)[]

Indirect references to file specification dictionaries.

## Returns

[`PdfArray`](../classes/PdfArray.md)

A PdfArray containing the references.
