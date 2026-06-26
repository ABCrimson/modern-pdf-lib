[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfSignatureInfo

# Interface: PdfSignatureInfo

Defined in: [src/signature/signatureHandler.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L80)

Information about an existing signature in a PDF.

## Properties

### byteRange

```ts
byteRange: [number, number, number, number];
```

Defined in: [src/signature/signatureHandler.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L94)

The ByteRange covering this signature.

***

### contactInfo?

```ts
optional contactInfo?: string;
```

Defined in: [src/signature/signatureHandler.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L90)

Contact information.

***

### fieldName

```ts
fieldName: string;
```

Defined in: [src/signature/signatureHandler.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L82)

The signature field name.

***

### location?

```ts
optional location?: string;
```

Defined in: [src/signature/signatureHandler.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L88)

Location of signing.

***

### reason?

```ts
optional reason?: string;
```

Defined in: [src/signature/signatureHandler.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L86)

Reason for signing.

***

### signatureValid?

```ts
optional signatureValid?: boolean;
```

Defined in: [src/signature/signatureHandler.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L96)

Whether the signature is valid (set during verification).

***

### signedBy

```ts
signedBy: string;
```

Defined in: [src/signature/signatureHandler.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L84)

Subject CN from the certificate.

***

### signingDate?

```ts
optional signingDate?: Date;
```

Defined in: [src/signature/signatureHandler.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L92)

Signing date/time.
