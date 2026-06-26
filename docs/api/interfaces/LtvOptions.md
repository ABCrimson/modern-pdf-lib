[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LtvOptions

# Interface: LtvOptions

Defined in: [src/signature/ltvEmbed.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L35)

Options for LTV data embedding.

## Properties

### crls?

> `optional` **crls?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L45)

Pre-loaded CRLs (DER-encoded).

***

### extraCertificates?

> `optional` **extraCertificates?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L47)

Additional certificates (DER-encoded) for the chain.

***

### includeCerts?

> `optional` **includeCerts?**: `boolean`

Defined in: [src/signature/ltvEmbed.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L41)

Include certificate chains in the DSS. Default: true.

***

### includeCrl?

> `optional` **includeCrl?**: `boolean`

Defined in: [src/signature/ltvEmbed.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L39)

Include CRL data in the DSS. Default: true.

***

### includeOcsp?

> `optional` **includeOcsp?**: `boolean`

Defined in: [src/signature/ltvEmbed.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L37)

Include OCSP responses in the DSS. Default: true.

***

### ocspResponses?

> `optional` **ocspResponses?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L43)

Pre-loaded OCSP responses (DER-encoded).
