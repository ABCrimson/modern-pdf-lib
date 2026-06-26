[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / appendIncrementalUpdate

# Function: appendIncrementalUpdate()

> **appendIncrementalUpdate**(`originalPdf`, `newObjects`, `_options?`): `Uint8Array`

Defined in: [src/signature/incrementalSave.ts:429](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/incrementalSave.ts#L429)

Append a pure incremental update to a PDF.

This function NEVER modifies bytes before the last %%EOF.
It appends new/modified objects, a new xref subsection, and a
new trailer with a /Prev pointer to the previous xref.

## Parameters

### originalPdf

`Uint8Array`

The original PDF bytes.

### newObjects

[`IncrementalObject`](../interfaces/IncrementalObject.md)[]

Objects to append (new or modified).

### \_options?

[`AppendOptions`](../interfaces/AppendOptions.md)

## Returns

`Uint8Array`

The updated PDF bytes.
