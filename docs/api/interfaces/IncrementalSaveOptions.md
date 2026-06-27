[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalSaveOptions

# Interface: IncrementalSaveOptions

Defined in: [src/signature/incrementalSave.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L41)

Options for incremental save with signature preservation.

## Properties

### compress?

```ts
optional compress?: boolean;
```

Defined in: [src/signature/incrementalSave.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L43)

Apply FlateDecode compression to new stream objects. Default: true.

***

### preserveSignatures?

```ts
optional preserveSignatures?: boolean;
```

Defined in: [src/signature/incrementalSave.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L45)

Preserve existing signatures by verifying byte ranges. Default: true.
