[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createMarkedContentScope

# Function: createMarkedContentScope()

> **createMarkedContentScope**(`tag`, `mcid`): [`MarkedContentScope`](../interfaces/MarkedContentScope.md)

Defined in: [src/accessibility/markedContent.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/accessibility/markedContent.ts#L147)

Create a [MarkedContentScope](../interfaces/MarkedContentScope.md) object for a given tag and MCID.

The scope provides `begin()` and `end()` methods to generate the
matching operator strings.  This is useful when you want to
incrementally build content between the markers.

## Parameters

### tag

[`StructureType`](../type-aliases/StructureType.md)

The structure type tag.

### mcid

`number`

The marked-content identifier.

## Returns

[`MarkedContentScope`](../interfaces/MarkedContentScope.md)

A [MarkedContentScope](../interfaces/MarkedContentScope.md) object.
