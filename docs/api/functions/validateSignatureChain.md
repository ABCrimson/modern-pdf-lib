[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateSignatureChain

# Function: validateSignatureChain()

```ts
function validateSignatureChain(pdf): Promise<SignatureChainResult>;
```

Defined in: [src/signature/multiSignatureValidator.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/multiSignatureValidator.ts#L167)

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
