[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignOptions

# Interface: SignOptions

Defined in: [src/signature/signatureHandler.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L54)

Options for signing a PDF.

## Properties

### appearance?

```ts
optional appearance?: VisibleSignatureOptions;
```

Defined in: [src/signature/signatureHandler.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L74)

Visible signature appearance options. When provided, the signature
field is rendered visibly on the specified page with text and
optional styling. When omitted, the signature is invisible.

***

### certificate

```ts
certificate: Uint8Array;
```

Defined in: [src/signature/signatureHandler.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L56)

DER-encoded X.509 certificate.

***

### contactInfo?

```ts
optional contactInfo?: string;
```

Defined in: [src/signature/signatureHandler.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L66)

Contact information.

***

### hashAlgorithm?

```ts
optional hashAlgorithm?: "SHA-256" | "SHA-384" | "SHA-512";
```

Defined in: [src/signature/signatureHandler.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L60)

Hash algorithm. Default: 'SHA-256'.

***

### location?

```ts
optional location?: string;
```

Defined in: [src/signature/signatureHandler.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L64)

Location of signing.

***

### privateKey

```ts
privateKey: Uint8Array;
```

Defined in: [src/signature/signatureHandler.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L58)

PKCS#8 DER-encoded private key.

***

### reason?

```ts
optional reason?: string;
```

Defined in: [src/signature/signatureHandler.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L62)

Reason for signing.

***

### timestampUrl?

```ts
optional timestampUrl?: string;
```

Defined in: [src/signature/signatureHandler.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L68)

RFC 3161 TSA URL for timestamping (optional).
