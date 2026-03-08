[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginArtifact

# Function: beginArtifact()

> **beginArtifact**(): `string`

Defined in: [src/accessibility/markedContent.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/accessibility/markedContent.ts#L172)

Generate an `Artifact` marked-content operator for content that is
not part of the document's logical structure (e.g. page numbers,
headers, footers, decorative borders).

Produces: `/Artifact BMC\n`

## Returns

`string`

The PDF operator string.
