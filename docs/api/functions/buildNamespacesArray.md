[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildNamespacesArray

# Function: buildNamespacesArray()

```ts
function buildNamespacesArray(defs): PdfArray;
```

Defined in: [src/accessibility/namespaces.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/namespaces.ts#L116)

Build the `/Namespaces` array (as found in `/StructTreeRoot`) from a
list of [NamespaceDef](../interfaces/NamespaceDef.md) descriptors.

## Parameters

### defs

readonly [`NamespaceDef`](../interfaces/NamespaceDef.md)[]

the namespace descriptors, in order.

## Returns

[`PdfArray`](../classes/PdfArray.md)

a [PdfArray](../classes/PdfArray.md) of `/Namespace` dictionaries.
