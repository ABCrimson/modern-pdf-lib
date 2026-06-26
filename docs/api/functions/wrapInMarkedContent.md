[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / wrapInMarkedContent

# Function: wrapInMarkedContent()

```ts
function wrapInMarkedContent(
   operators, 
   tag, 
   mcid): string;
```

Defined in: [src/accessibility/markedContent.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/markedContent.ts#L128)

Wrap existing content-stream operators in a marked-content sequence.

This is a convenience function that prepends a `BDC` operator and
appends an `EMC` operator around the given operator string.

## Parameters

### operators

`string`

The existing PDF operator string(s) to wrap.

### tag

[`StructureType`](../type-aliases/StructureType.md)

The structure type tag.

### mcid

`number`

The marked-content identifier.

## Returns

`string`

The wrapped operator string.
