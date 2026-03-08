[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getCertificationLevel

# Function: getCertificationLevel()

> **getCertificationLevel**(`pdf`): [`MdpPermission`](../enumerations/MdpPermission.md) \| `undefined`

Defined in: [src/signature/mdpPolicy.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/mdpPolicy.ts#L95)

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
