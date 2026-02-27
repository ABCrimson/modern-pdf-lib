[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginMarkedContent

# Function: beginMarkedContent()

> **beginMarkedContent**(`tag`): `string`

Defined in: [src/accessibility/markedContent.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L62)

Generate a `BMC` (begin marked content) operator with just a tag.

This is the simplest form of marked content — no properties dict.
Produces: `/<tag> BMC\n`

## Parameters

### tag

`string`

The marked-content tag (e.g. `"Span"`, `"Artifact"`).

## Returns

`string`

The PDF operator string.
