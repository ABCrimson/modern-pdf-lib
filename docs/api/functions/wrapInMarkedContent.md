[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / wrapInMarkedContent

# Function: wrapInMarkedContent()

> **wrapInMarkedContent**(`operators`, `tag`, `mcid`): `string`

Defined in: [src/accessibility/markedContent.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/accessibility/markedContent.ts#L128)

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
