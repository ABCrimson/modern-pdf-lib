[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildAfArray

# Function: buildAfArray()

> **buildAfArray**(`fileSpecRefs`): [`PdfArray`](../classes/PdfArray.md)

Defined in: [src/compliance/associatedFiles.ts:151](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/compliance/associatedFiles.ts#L151)

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
