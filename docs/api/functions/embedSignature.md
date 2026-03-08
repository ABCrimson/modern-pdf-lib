[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedSignature

# Function: embedSignature()

> **embedSignature**(`preparedPdf`, `signatureBytes`, `byteRange`): `Uint8Array`

Defined in: [src/signature/byteRange.ts:578](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/byteRange.ts#L578)

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
