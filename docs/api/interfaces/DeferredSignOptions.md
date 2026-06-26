[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeferredSignOptions

# Interface: DeferredSignOptions

Defined in: [src/signature/externalSigner.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L58)

Options controlling a [signDeferred](../functions/signDeferred.md) operation.

## Properties

### hashAlgorithm?

```ts
readonly optional hashAlgorithm?: "SHA-256" | "SHA-384" | "SHA-512";
```

Defined in: [src/signature/externalSigner.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L64)

The hash algorithm used to digest the data before signing.

Defaults to `'SHA-256'` when omitted.
