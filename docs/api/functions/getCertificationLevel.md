[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getCertificationLevel

# Function: getCertificationLevel()

> **getCertificationLevel**(`pdf`): [`MdpPermission`](../enumerations/MdpPermission.md) \| `undefined`

Defined in: [src/signature/mdpPolicy.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/mdpPolicy.ts#L94)

Read the certification level (MDP permission) from a PDF.

Scans the PDF for the first /DocMDP transform method and extracts
the /P value from its /TransformParams. Returns `undefined` if no
certification signature is found.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`MdpPermission`](../enumerations/MdpPermission.md) \| `undefined`

The MDP permission level, or `undefined` if not certified.
