[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfSignatureInfo

# Interface: PdfSignatureInfo

Defined in: [src/signature/signatureHandler.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L80)

Information about an existing signature in a PDF.

## Properties

### byteRange

> **byteRange**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/signature/signatureHandler.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L94)

The ByteRange covering this signature.

***

### contactInfo?

> `optional` **contactInfo**: `string`

Defined in: [src/signature/signatureHandler.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L90)

Contact information.

***

### fieldName

> **fieldName**: `string`

Defined in: [src/signature/signatureHandler.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L82)

The signature field name.

***

### location?

> `optional` **location**: `string`

Defined in: [src/signature/signatureHandler.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L88)

Location of signing.

***

### reason?

> `optional` **reason**: `string`

Defined in: [src/signature/signatureHandler.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L86)

Reason for signing.

***

### signatureValid?

> `optional` **signatureValid**: `boolean`

Defined in: [src/signature/signatureHandler.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L96)

Whether the signature is valid (set during verification).

***

### signedBy

> **signedBy**: `string`

Defined in: [src/signature/signatureHandler.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L84)

Subject CN from the certificate.

***

### signingDate?

> `optional` **signingDate**: `Date`

Defined in: [src/signature/signatureHandler.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureHandler.ts#L92)

Signing date/time.
