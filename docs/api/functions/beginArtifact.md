[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifact

# Function: beginArtifact()

```ts
function beginArtifact(): string;
```

Defined in: [src/accessibility/markedContent.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/markedContent.ts#L172)

Generate an `Artifact` marked-content operator for content that is
not part of the document's logical structure (e.g. page numbers,
headers, footers, decorative borders).

Produces: `/Artifact BMC\n`

## Returns

`string`

The PDF operator string.
