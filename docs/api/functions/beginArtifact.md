[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifact

# Function: beginArtifact()

```ts
function beginArtifact(): string;
```

Defined in: [src/accessibility/markedContent.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/markedContent.ts#L172)

Generate an `Artifact` marked-content operator for content that is
not part of the document's logical structure (e.g. page numbers,
headers, footers, decorative borders).

Produces: `/Artifact BMC\n`

## Returns

`string`

The PDF operator string.
