[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginMarkedContentSequence

# Function: beginMarkedContentSequence()

> **beginMarkedContentSequence**(`tag`, `mcid`): `string`

Defined in: [src/accessibility/markedContent.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L110)

Generate a `BDC` operator for a structure-tagged marked-content
sequence with an MCID.

This is the most common form used in tagged PDF: it begins a
content region associated with a specific structure element via
the MCID.

Produces: `/<tag> <</MCID n>> BDC\n`

## Parameters

### tag

[`StructureType`](../type-aliases/StructureType.md)

The structure type (e.g. `"P"`, `"H1"`, `"Span"`).

### mcid

`number`

The marked-content identifier.

## Returns

`string`

The PDF operator string.
