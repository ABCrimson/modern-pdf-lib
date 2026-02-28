[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifactWithType

# Function: beginArtifactWithType()

> **beginArtifactWithType**(`artifactType`, `subtype?`): `string`

Defined in: [src/accessibility/markedContent.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/accessibility/markedContent.ts#L186)

Generate an `Artifact` BDC operator with properties specifying the
artifact type and other attributes.

## Parameters

### artifactType

The type of artifact: `"Pagination"`,
                     `"Layout"`, or `"Background"`.

`"Pagination"` | `"Layout"` | `"Background"`

### subtype?

`string`

Optional subtype (e.g. `"Header"`, `"Footer"`,
                     `"Watermark"`).

## Returns

`string`

The PDF operator string.
