[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExternalSigner

# Interface: ExternalSigner

Defined in: [src/signature/externalSigner.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L37)

A signing backend whose private key is held externally (HSM / KMS /
WebCrypto). Implementations receive only a message digest and return the
raw signature bytes; the private key never crosses this boundary.

## Properties

### algorithm

```ts
readonly algorithm: SignatureAlgorithm;
```

Defined in: [src/signature/externalSigner.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L39)

The signature algorithm family this backend uses.

## Methods

### getCertificateChain()

```ts
getCertificateChain(): Promise<Uint8Array<ArrayBufferLike>[]>;
```

Defined in: [src/signature/externalSigner.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L52)

Retrieve the certificate chain associated with the signing key.

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]\&gt;

The certificate chain, leaf-first, as DER-encoded byte arrays.

***

### sign()

```ts
sign(digest): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/signature/externalSigner.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L46)

Sign a pre-computed message digest.

#### Parameters

##### digest

`Uint8Array`

The hash of the data to be signed.

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The raw signature bytes produced by the backend.
