[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addCounterSignature

# Function: addCounterSignature()

> **addCounterSignature**(`pdf`, `targetSignatureIndex`, `signerInfo`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/signature/counterSignature.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/counterSignature.ts#L260)

Add a counter-signature to an existing PDF signature.

Finds the target signature's /Contents, computes a hash of the
existing signature value, creates a PKCS#7 counter-signature
attribute, and appends the result via incremental update.

## Parameters

### pdf

`Uint8Array`

The PDF bytes containing the target signature.

### targetSignatureIndex

`number`

Zero-based index of the signature to counter-sign.

### signerInfo

The counter-signer's certificate, private key, and hash algorithm.

#### certificate

`Uint8Array`

#### hashAlgorithm?

`string`

#### privateKey

`Uint8Array`

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The PDF with the counter-signature appended.

## Example

```ts
const counterSigned = await addCounterSignature(
  signedPdf,
  0,
  { certificate: certDer, privateKey: keyDer },
);
```
