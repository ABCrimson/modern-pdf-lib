[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / signPdf

# Function: signPdf()

```ts
function signPdf(
   pdfBytes, 
   fieldName, 
options): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/signature/signatureHandler.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L277)

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

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

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
