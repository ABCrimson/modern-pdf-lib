[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DssData

# Interface: DssData

Defined in: [src/signature/ltvEmbed.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L53)

Data for the Document Security Store dictionary.

## Properties

### certs

> **certs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L55)

DER-encoded certificates for the chain.

***

### crls

> **crls**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L59)

DER-encoded CRLs.

***

### ocsps

> **ocsps**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L57)

DER-encoded OCSP responses.
