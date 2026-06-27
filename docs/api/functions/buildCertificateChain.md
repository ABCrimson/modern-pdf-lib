[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildCertificateChain

# Function: buildCertificateChain()

```ts
function buildCertificateChain(leaf, intermediates): CertificateChainResult;
```

Defined in: [src/signature/chainValidator.ts:473](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/chainValidator.ts#L473)

Build a certificate chain from a leaf certificate to a root.

Starting from the leaf, finds the issuer among the provided
intermediate certificates, repeating until a self-signed root
is found or no matching issuer exists.

## Parameters

### leaf

`Uint8Array`

DER-encoded leaf certificate.

### intermediates

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]

DER-encoded intermediate certificates.

## Returns

`CertificateChainResult`

The ordered chain (leaf first, root last) and
                       whether it is complete.
