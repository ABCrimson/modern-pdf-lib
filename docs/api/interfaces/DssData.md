[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DssData

# Interface: DssData

Defined in: [src/signature/ltvEmbed.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/ltvEmbed.ts#L55)

Data for the Document Security Store dictionary.

## Properties

### certs

> **certs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/ltvEmbed.ts#L57)

DER-encoded certificates for the chain.

***

### crls

> **crls**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/ltvEmbed.ts#L61)

DER-encoded CRLs.

***

### ocsps

> **ocsps**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/signature/ltvEmbed.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/ltvEmbed.ts#L59)

DER-encoded OCSP responses.
