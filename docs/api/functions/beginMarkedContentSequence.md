[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginMarkedContentSequence

# Function: beginMarkedContentSequence()

> **beginMarkedContentSequence**(`tag`, `mcid`): `string`

Defined in: [src/accessibility/markedContent.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/accessibility/markedContent.ts#L110)

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
