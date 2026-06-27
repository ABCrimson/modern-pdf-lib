[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BarcodeMatrix

# Interface: BarcodeMatrix

Defined in: [src/barcode/types.ts:15](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/types.ts#L15)

Encoded barcode data — a sequence of modules (bars and spaces).

Each entry in `modules` is `true` for a dark bar and `false` for a
light space.  The `width` property gives the total number of modules.

## Properties

### modules

```ts
readonly modules: readonly boolean[];
```

Defined in: [src/barcode/types.ts:17](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/types.ts#L17)

Module pattern: `true` = dark bar, `false` = light space.

***

### width

```ts
readonly width: number;
```

Defined in: [src/barcode/types.ts:19](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/types.ts#L19)

Total number of modules (= `modules.length`).
