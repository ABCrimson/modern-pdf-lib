[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / signPdf

# Function: signPdf()

> **signPdf**(`pdfBytes`, `fieldName`, `options`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/signature/signatureHandler.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/signature/signatureHandler.ts#L242)

Sign a PDF document.

Returns the signed PDF bytes. Uses incremental save to preserve
existing content (including any previous signatures).

## Parameters

### pdfBytes

`Uint8Array`

The original PDF file bytes.

### fieldName

`string`

The name for the signature field.

### options

[`SignOptions`](../interfaces/SignOptions.md)

Signing options (certificate, key, etc.).

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The signed PDF bytes.

## Example

```ts
const signedPdf = await signPdf(pdfBytes, 'Signature1', {
  certificate: certDer,
  privateKey: keyDer,
  reason: 'Document approval',
  location: 'New York, NY',
});
```
