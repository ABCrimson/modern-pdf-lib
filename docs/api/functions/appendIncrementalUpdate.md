[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / appendIncrementalUpdate

# Function: appendIncrementalUpdate()

> **appendIncrementalUpdate**(`originalPdf`, `newObjects`, `options?`): `Uint8Array`

Defined in: [src/signature/incrementalSave.ts:452](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L452)

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

### options?

[`AppendOptions`](../interfaces/AppendOptions.md)

Options for the append operation.

## Returns

`Uint8Array`

The updated PDF bytes.
