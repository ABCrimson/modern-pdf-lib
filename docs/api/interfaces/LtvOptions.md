[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LtvOptions

# Interface: LtvOptions

Defined in: [src/signature/ltvEmbed.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L37)

Options for LTV data embedding.

## Properties

### crls?

> `optional` **crls**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L47)

Pre-loaded CRLs (DER-encoded).

***

### extraCertificates?

> `optional` **extraCertificates**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L49)

Additional certificates (DER-encoded) for the chain.

***

### includeCerts?

> `optional` **includeCerts**: `boolean`

Defined in: [src/signature/ltvEmbed.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L43)

Include certificate chains in the DSS. Default: true.

***

### includeCrl?

> `optional` **includeCrl**: `boolean`

Defined in: [src/signature/ltvEmbed.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L41)

Include CRL data in the DSS. Default: true.

***

### includeOcsp?

> `optional` **includeOcsp**: `boolean`

Defined in: [src/signature/ltvEmbed.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L39)

Include OCSP responses in the DSS. Default: true.

***

### ocspResponses?

> `optional` **ocspResponses**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L45)

Pre-loaded OCSP responses (DER-encoded).
