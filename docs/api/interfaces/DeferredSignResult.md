[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeferredSignResult

# Interface: DeferredSignResult

Defined in: src/signature/externalSigner.ts:70

The result of a [signDeferred](../functions/signDeferred.md) operation.

## Properties

### certificateChain

> `readonly` **certificateChain**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: src/signature/externalSigner.ts:76

The certificate chain returned by the external signer, leaf-first.

***

### digest

> `readonly` **digest**: `Uint8Array`

Defined in: src/signature/externalSigner.ts:72

The digest of the input data that was handed to the signer.

***

### signature

> `readonly` **signature**: `Uint8Array`

Defined in: src/signature/externalSigner.ts:74

The raw signature bytes returned by the external signer.
