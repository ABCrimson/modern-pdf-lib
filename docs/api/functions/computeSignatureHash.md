[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeSignatureHash

# Function: computeSignatureHash()

```ts
function computeSignatureHash(
   pdfBytes, 
   byteRange, 
algorithm?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/signature/byteRange.ts:507](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L507)

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

`"SHA-256"` \| `"SHA-384"` \| `"SHA-512"`

Hash algorithm. Default 'SHA-256'.

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The hash digest.
