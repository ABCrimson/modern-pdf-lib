[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginMarkedContentWithProperties

# Function: beginMarkedContentWithProperties()

> **beginMarkedContentWithProperties**(`tag`, `properties`): `string`

Defined in: [src/accessibility/markedContent.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/accessibility/markedContent.ts#L79)

Generate a `BDC` (begin marked-content with properties) operator.

The properties dictionary is serialized inline.  This is used when
you need to associate additional data (like MCID) with the marked
content.

Produces: `/<tag> <</MCID n /key1 value1 ...>> BDC\n`

## Parameters

### tag

`string`

The marked-content tag.

### properties

`Record`\<`string`, `unknown`\>

Key-value pairs for the properties dictionary.

## Returns

`string`

The PDF operator string.
