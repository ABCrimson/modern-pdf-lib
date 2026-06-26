[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getCertificationLevel

# Function: getCertificationLevel()

```ts
function getCertificationLevel(pdf): MdpPermission | undefined;
```

Defined in: [src/signature/mdpPolicy.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/mdpPolicy.ts#L94)

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
