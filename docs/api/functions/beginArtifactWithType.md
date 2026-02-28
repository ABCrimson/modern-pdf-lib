[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifactWithType

# Function: beginArtifactWithType()

> **beginArtifactWithType**(`artifactType`, `subtype?`): `string`

Defined in: [src/accessibility/markedContent.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/accessibility/markedContent.ts#L186)

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
