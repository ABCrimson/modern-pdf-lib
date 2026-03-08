[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateSignatureChain

# Function: validateSignatureChain()

> **validateSignatureChain**(`pdf`): `Promise`\<[`SignatureChainResult`](../interfaces/SignatureChainResult.md)\>

Defined in: [src/signature/multiSignatureValidator.ts:209](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/multiSignatureValidator.ts#L209)

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
