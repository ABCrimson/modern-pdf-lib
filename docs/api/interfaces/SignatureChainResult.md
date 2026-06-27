[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureChainResult

# Interface: SignatureChainResult

Defined in: [src/signature/multiSignatureValidator.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/multiSignatureValidator.ts#L47)

Result of validating the entire signature chain.

## Properties

### errors

```ts
errors: string[];
```

Defined in: [src/signature/multiSignatureValidator.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/multiSignatureValidator.ts#L53)

Descriptive error messages, if any.

***

### isChainValid

```ts
isChainValid: boolean;
```

Defined in: [src/signature/multiSignatureValidator.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/multiSignatureValidator.ts#L51)

Whether the entire chain is valid (all entries valid, no breaks).

***

### signatures

```ts
signatures: SignatureChainEntry[];
```

Defined in: [src/signature/multiSignatureValidator.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/multiSignatureValidator.ts#L49)

Ordered array of signature chain entries.
