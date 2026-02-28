[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createMarkedContentScope

# Function: createMarkedContentScope()

> **createMarkedContentScope**(`tag`, `mcid`): [`MarkedContentScope`](../interfaces/MarkedContentScope.md)

Defined in: [src/accessibility/markedContent.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/accessibility/markedContent.ts#L147)

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
