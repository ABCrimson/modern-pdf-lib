[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / hasLtvData

# Function: hasLtvData()

> **hasLtvData**(`pdf`): `boolean`

Defined in: [src/signature/ltvEmbed.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/ltvEmbed.ts#L172)

Check whether a PDF already contains a Document Security Store (DSS).

## Parameters

### pdf

`Uint8Array`

The PDF bytes.

## Returns

`boolean`

`true` if the PDF contains a /DSS dictionary.
