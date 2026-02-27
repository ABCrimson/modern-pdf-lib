[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPkcs7Signature

# Function: buildPkcs7Signature()

> **buildPkcs7Signature**(`dataHash`, `options`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/signature/pkcs7.ts:715](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/pkcs7.ts#L715)

Build a PKCS#7 (CMS) SignedData structure for a PDF signature.

Takes a pre-computed hash of the PDF content (excluding the
/Contents placeholder) and produces a DER-encoded PKCS#7 blob
that can be embedded in the PDF's /Contents field.

## Parameters

### dataHash

`Uint8Array`

The hash of the PDF bytes covered by ByteRange.

### options

[`SignatureOptions`](../interfaces/SignatureOptions.md)

Signing options (certificate, key, etc.).

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

DER-encoded PKCS#7 SignedData.
