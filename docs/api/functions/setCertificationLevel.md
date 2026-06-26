[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setCertificationLevel

# Function: setCertificationLevel()

> **setCertificationLevel**(`options`, `level`): `void`

Defined in: [src/signature/mdpPolicy.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/mdpPolicy.ts#L75)

Set the certification level (MDP permission) on sign options.

When applied, the resulting signature will include a /DocMDP
transform method in its /TransformParams, which certifies the
document and restricts future modifications to the specified level.

This should only be used for the FIRST (certification) signature
in a document. Subsequent approval signatures should not set MDP.

## Parameters

### options

[`SignOptions`](../interfaces/SignOptions.md)

The sign options to modify (mutated in place).

### level

[`MdpPermission`](../enumerations/MdpPermission.md)

The MDP permission level to set.

## Returns

`void`

## Example

```ts
const options: SignOptions = {
  certificate: certDer,
  privateKey: keyDer,
};
setCertificationLevel(options, MdpPermission.FormFillAndSign);
const signedPdf = await signPdf(pdfBytes, 'CertSig', options);
```
