[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildNamespacesArray

# Function: buildNamespacesArray()

> **buildNamespacesArray**(`defs`): [`PdfArray`](../classes/PdfArray.md)

Defined in: src/accessibility/namespaces.ts:116

Build the `/Namespaces` array (as found in `/StructTreeRoot`) from a
list of [NamespaceDef](../interfaces/NamespaceDef.md) descriptors.

## Parameters

### defs

readonly [`NamespaceDef`](../interfaces/NamespaceDef.md)[]

the namespace descriptors, in order.

## Returns

[`PdfArray`](../classes/PdfArray.md)

a [PdfArray](../classes/PdfArray.md) of `/Namespace` dictionaries.
