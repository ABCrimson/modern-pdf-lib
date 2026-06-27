[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DssData

# Interface: DssData

Defined in: [src/signature/ltvEmbed.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/ltvEmbed.ts#L53)

Data for the Document Security Store dictionary.

## Properties

### certs

```ts
certs: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/ltvEmbed.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/ltvEmbed.ts#L55)

DER-encoded certificates for the chain.

***

### crls

```ts
crls: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/ltvEmbed.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/ltvEmbed.ts#L59)

DER-encoded CRLs.

***

### ocsps

```ts
ocsps: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/ltvEmbed.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/ltvEmbed.ts#L57)

DER-encoded OCSP responses.
