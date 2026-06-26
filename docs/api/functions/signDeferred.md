[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / signDeferred

# Function: signDeferred()

```ts
function signDeferred(
   data, 
   signer, 
options?): Promise<DeferredSignResult>;
```

Defined in: [src/signature/externalSigner.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L96)

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

`Promise`\&lt;[`DeferredSignResult`](../interfaces/DeferredSignResult.md)\&gt;

The digest, the raw signature, and the certificate chain.
