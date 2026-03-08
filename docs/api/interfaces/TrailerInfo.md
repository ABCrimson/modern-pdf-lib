[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TrailerInfo

# Interface: TrailerInfo

Defined in: [src/signature/incrementalSave.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L71)

Information extracted from an existing PDF trailer.

## Properties

### infoRef?

> `optional` **infoRef**: `string`

Defined in: [src/signature/incrementalSave.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L77)

The /Info reference string (e.g., "4 0 R"), if present.

***

### prevXrefOffset

> **prevXrefOffset**: `number`

Defined in: [src/signature/incrementalSave.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L79)

The byte offset of the previous cross-reference section.

***

### rootRef

> **rootRef**: `string`

Defined in: [src/signature/incrementalSave.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L75)

The /Root reference string (e.g., "1 0 R").

***

### size

> **size**: `number`

Defined in: [src/signature/incrementalSave.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L73)

The /Size value (total number of objects).
