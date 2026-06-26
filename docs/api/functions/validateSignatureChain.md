[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateSignatureChain

# Function: validateSignatureChain()

```ts
function validateSignatureChain(pdf): Promise<SignatureChainResult>;
```

Defined in: [src/signature/multiSignatureValidator.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/multiSignatureValidator.ts#L167)

Validate the entire signature chain in a PDF.

Finds all signatures, validates each one covers the correct byte range,
and verifies each subsequent signature covers all content including
previous signatures. Returns an ordered chain with status for each entry.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to validate.

## Returns

`Promise`\&lt;[`SignatureChainResult`](../interfaces/SignatureChainResult.md)\&gt;

The signature chain validation result.
