[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeferredSignResult

# Interface: DeferredSignResult

Defined in: [src/signature/externalSigner.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/externalSigner.ts#L70)

The result of a [signDeferred](../functions/signDeferred.md) operation.

## Properties

### certificateChain

```ts
readonly certificateChain: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/signature/externalSigner.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/externalSigner.ts#L76)

The certificate chain returned by the external signer, leaf-first.

***

### digest

```ts
readonly digest: Uint8Array;
```

Defined in: [src/signature/externalSigner.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/externalSigner.ts#L72)

The digest of the input data that was handed to the signer.

***

### signature

```ts
readonly signature: Uint8Array;
```

Defined in: [src/signature/externalSigner.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/externalSigner.ts#L74)

The raw signature bytes returned by the external signer.
