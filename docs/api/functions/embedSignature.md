[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedSignature

# Function: embedSignature()

```ts
function embedSignature(
   preparedPdf, 
   signatureBytes, 
   byteRange): Uint8Array;
```

Defined in: [src/signature/byteRange.ts:554](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/byteRange.ts#L554)

Embed a signature into the prepared PDF at the placeholder position.

Writes the hex-encoded signature bytes into the `/Contents <…>`
placeholder, replacing the zero bytes.

## Parameters

### preparedPdf

`Uint8Array`

The prepared PDF bytes (from prepareForSigning).

### signatureBytes

`Uint8Array`

The DER-encoded signature (PKCS#7/CMS).

### byteRange

[`ByteRangeResult`](../interfaces/ByteRangeResult.md)

The ByteRange result from prepareForSigning.

## Returns

`Uint8Array`

The signed PDF bytes.
