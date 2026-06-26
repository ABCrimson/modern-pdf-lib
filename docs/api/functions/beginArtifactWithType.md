[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifactWithType

# Function: beginArtifactWithType()

```ts
function beginArtifactWithType(artifactType, subtype?): string;
```

Defined in: [src/accessibility/markedContent.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/markedContent.ts#L186)

Generate an `Artifact` BDC operator with properties specifying the
artifact type and other attributes.

## Parameters

### artifactType

`"Pagination"` \| `"Layout"` \| `"Background"`

The type of artifact: `"Pagination"`,
                     `"Layout"`, or `"Background"`.

### subtype?

`string`

Optional subtype (e.g. `"Header"`, `"Footer"`,
                     `"Watermark"`).

## Returns

`string`

The PDF operator string.
