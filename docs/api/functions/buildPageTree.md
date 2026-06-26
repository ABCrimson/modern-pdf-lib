[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPageTree

# Function: buildPageTree()

```ts
function buildPageTree(pages, registry): PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L160)

Build the `/Pages` tree and individual `/Page` dictionaries.

This implementation uses a flat page tree (a single `/Pages` node)
which is correct for documents with up to several thousand pages.

## Parameters

### pages

readonly [`PageEntry`](../interfaces/PageEntry.md)[]

Ordered list of page entries.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the root `/Pages` node.
