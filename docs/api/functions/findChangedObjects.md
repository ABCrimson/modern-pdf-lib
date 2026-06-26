[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findChangedObjects

# Function: findChangedObjects()

```ts
function findChangedObjects(original, modified): number[];
```

Defined in: [src/signature/incrementalOptimizer.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalOptimizer.ts#L111)

Find the list of object numbers whose content actually changed
between two versions of a PDF.

Extracts all objects from both versions, hashes their content
using FNV-1a, and returns the object numbers where the hashes
differ.

## Parameters

### original

`Uint8Array`

The original PDF bytes.

### modified

`Uint8Array`

The modified PDF bytes.

## Returns

`number`[]

Array of object numbers that have different content.

## Example

```ts
const changed = findChangedObjects(originalPdf, modifiedPdf);
console.log(`${changed.length} objects actually changed`);
```
