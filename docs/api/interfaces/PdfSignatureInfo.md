[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfSignatureInfo

# Interface: PdfSignatureInfo

Defined in: [src/signature/signatureHandler.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L45)

Information about an existing signature in a PDF.

## Properties

### byteRange

> **byteRange**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/signature/signatureHandler.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L59)

The ByteRange covering this signature.

***

### contactInfo?

> `optional` **contactInfo**: `string`

Defined in: [src/signature/signatureHandler.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L55)

Contact information.

***

### fieldName

> **fieldName**: `string`

Defined in: [src/signature/signatureHandler.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L47)

The signature field name.

***

### location?

> `optional` **location**: `string`

Defined in: [src/signature/signatureHandler.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L53)

Location of signing.

***

### reason?

> `optional` **reason**: `string`

Defined in: [src/signature/signatureHandler.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L51)

Reason for signing.

***

### signatureValid?

> `optional` **signatureValid**: `boolean`

Defined in: [src/signature/signatureHandler.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L61)

Whether the signature is valid (set during verification).

***

### signedBy

> **signedBy**: `string`

Defined in: [src/signature/signatureHandler.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L49)

Subject CN from the certificate.

***

### signingDate?

> `optional` **signingDate**: `Date`

Defined in: [src/signature/signatureHandler.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L57)

Signing date/time.
