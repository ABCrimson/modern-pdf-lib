[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / signDeferred

# Function: signDeferred()

> **signDeferred**(`data`, `signer`, `options?`): `Promise`\<[`DeferredSignResult`](../interfaces/DeferredSignResult.md)\>

Defined in: src/signature/externalSigner.ts:96

Perform a deferred-hash signing operation against an external signer.

The data is digested locally with crypto.subtle.digest; the
resulting digest is handed to [ExternalSigner.sign](../interfaces/ExternalSigner.md#sign), and the
certificate chain is collected from [ExternalSigner.getCertificateChain](../interfaces/ExternalSigner.md#getcertificatechain).
The library never has access to the private key.

## Parameters

### data

`Uint8Array`

The bytes to be signed.

### signer

[`ExternalSigner`](../interfaces/ExternalSigner.md)

The external signing backend.

### options?

[`DeferredSignOptions`](../interfaces/DeferredSignOptions.md)

Optional configuration; see [DeferredSignOptions](../interfaces/DeferredSignOptions.md).

## Returns

`Promise`\<[`DeferredSignResult`](../interfaces/DeferredSignResult.md)\>

The digest, the raw signature, and the certificate chain.
