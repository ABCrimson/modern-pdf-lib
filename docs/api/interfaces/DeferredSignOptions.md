[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeferredSignOptions

# Interface: DeferredSignOptions

Defined in: src/signature/externalSigner.ts:58

Options controlling a [signDeferred](../functions/signDeferred.md) operation.

## Properties

### hashAlgorithm?

> `readonly` `optional` **hashAlgorithm?**: `"SHA-256"` \| `"SHA-384"` \| `"SHA-512"`

Defined in: src/signature/externalSigner.ts:64

The hash algorithm used to digest the data before signing.

Defaults to `'SHA-256'` when omitted.
