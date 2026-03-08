[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeSignatureHash

# Function: computeSignatureHash()

> **computeSignatureHash**(`pdfBytes`, `byteRange`, `algorithm?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/signature/byteRange.ts:531](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/byteRange.ts#L531)

Compute the hash of PDF bytes excluding the signature placeholder.

Hashes the bytes covered by the ByteRange (everything except
the `/Contents` hex string).

## Parameters

### pdfBytes

`Uint8Array`

The prepared PDF bytes.

### byteRange

\[`number`, `number`, `number`, `number`\]

The [offset1, length1, offset2, length2] array.

### algorithm?

Hash algorithm. Default 'SHA-256'.

`"SHA-256"` | `"SHA-384"` | `"SHA-512"`

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The hash digest.
