[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExternalSigner

# Interface: ExternalSigner

Defined in: src/signature/externalSigner.ts:37

A signing backend whose private key is held externally (HSM / KMS /
WebCrypto). Implementations receive only a message digest and return the
raw signature bytes; the private key never crosses this boundary.

## Properties

### algorithm

> `readonly` **algorithm**: [`SignatureAlgorithm`](../type-aliases/SignatureAlgorithm.md)

Defined in: src/signature/externalSigner.ts:39

The signature algorithm family this backend uses.

## Methods

### getCertificateChain()

> **getCertificateChain**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>[]\>

Defined in: src/signature/externalSigner.ts:52

Retrieve the certificate chain associated with the signing key.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>[]\>

The certificate chain, leaf-first, as DER-encoded byte arrays.

***

### sign()

> **sign**(`digest`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: src/signature/externalSigner.ts:46

Sign a pre-computed message digest.

#### Parameters

##### digest

`Uint8Array`

The hash of the data to be signed.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The raw signature bytes produced by the backend.
