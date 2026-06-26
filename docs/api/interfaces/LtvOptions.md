[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LtvOptions

# Interface: LtvOptions

Defined in: [src/signature/ltvEmbed.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L35)

Options for LTV data embedding.

## Properties

### crls?

```ts
optional crls?: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/ltvEmbed.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L45)

Pre-loaded CRLs (DER-encoded).

***

### extraCertificates?

```ts
optional extraCertificates?: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/ltvEmbed.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L47)

Additional certificates (DER-encoded) for the chain.

***

### includeCerts?

```ts
optional includeCerts?: boolean;
```

Defined in: [src/signature/ltvEmbed.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L41)

Include certificate chains in the DSS. Default: true.

***

### includeCrl?

```ts
optional includeCrl?: boolean;
```

Defined in: [src/signature/ltvEmbed.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L39)

Include CRL data in the DSS. Default: true.

***

### includeOcsp?

```ts
optional includeOcsp?: boolean;
```

Defined in: [src/signature/ltvEmbed.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L37)

Include OCSP responses in the DSS. Default: true.

***

### ocspResponses?

```ts
optional ocspResponses?: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/ltvEmbed.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L43)

Pre-loaded OCSP responses (DER-encoded).
