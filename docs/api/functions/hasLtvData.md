[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / hasLtvData

# Function: hasLtvData()

> **hasLtvData**(`pdf`): `boolean`

Defined in: [src/signature/ltvEmbed.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L170)

Check whether a PDF already contains a Document Security Store (DSS).

## Parameters

### pdf

`Uint8Array`

The PDF bytes.

## Returns

`boolean`

`true` if the PDF contains a /DSS dictionary.
