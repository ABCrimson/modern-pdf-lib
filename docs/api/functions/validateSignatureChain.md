[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateSignatureChain

# Function: validateSignatureChain()

> **validateSignatureChain**(`pdf`): `Promise`\<[`SignatureChainResult`](../interfaces/SignatureChainResult.md)\>

Defined in: [src/signature/multiSignatureValidator.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/multiSignatureValidator.ts#L167)

Validate the entire signature chain in a PDF.

Finds all signatures, validates each one covers the correct byte range,
and verifies each subsequent signature covers all content including
previous signatures. Returns an ordered chain with status for each entry.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to validate.

## Returns

`Promise`\<[`SignatureChainResult`](../interfaces/SignatureChainResult.md)\>

The signature chain validation result.
