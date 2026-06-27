[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocumentDiff

# Interface: DocumentDiff

Defined in: [src/signature/documentDiff.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L44)

Result of comparing signed content against the current PDF.

## Properties

### changes

```ts
changes: DiffEntry[];
```

Defined in: [src/signature/documentDiff.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L50)

All detected changes between the signed and current version.

***

### hasChanges

```ts
hasChanges: boolean;
```

Defined in: [src/signature/documentDiff.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L52)

Whether any changes were detected at all.

***

### signatureIndex

```ts
signatureIndex: number;
```

Defined in: [src/signature/documentDiff.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L46)

Which signature was used as the baseline (zero-based).

***

### signedAt?

```ts
optional signedAt?: Date;
```

Defined in: [src/signature/documentDiff.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L48)

The signing date from the signature dictionary, if available.
