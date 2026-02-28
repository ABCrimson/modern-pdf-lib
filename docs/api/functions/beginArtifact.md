[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifact

# Function: beginArtifact()

> **beginArtifact**(): `string`

Defined in: [src/accessibility/markedContent.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/accessibility/markedContent.ts#L172)

Generate an `Artifact` marked-content operator for content that is
not part of the document's logical structure (e.g. page numbers,
headers, footers, decorative borders).

Produces: `/Artifact BMC\n`

## Returns

`string`

The PDF operator string.
