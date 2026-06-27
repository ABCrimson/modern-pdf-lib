[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OptimizationReport

# Interface: OptimizationReport

Defined in: [src/assets/image/batchOptimize.ts:165](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L165)

Summary report from batch image optimization.

## Properties

### optimizedImages

```ts
readonly optimizedImages: number;
```

Defined in: [src/assets/image/batchOptimize.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L169)

Number of images that were recompressed.

***

### optimizedTotalBytes

```ts
readonly optimizedTotalBytes: number;
```

Defined in: [src/assets/image/batchOptimize.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L175)

Total new compressed size (all images).

***

### originalTotalBytes

```ts
readonly originalTotalBytes: number;
```

Defined in: [src/assets/image/batchOptimize.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L173)

Total original compressed size (all images).

***

### perImage

```ts
readonly perImage: readonly ImageOptimizeEntry[];
```

Defined in: [src/assets/image/batchOptimize.ts:179](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L179)

Per-image details.

***

### savings

```ts
readonly savings: number;
```

Defined in: [src/assets/image/batchOptimize.ts:177](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L177)

Overall savings percentage.

***

### skippedByFilter

```ts
readonly skippedByFilter: number;
```

Defined in: [src/assets/image/batchOptimize.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L171)

Number of images skipped due to selective filters.

***

### totalImages

```ts
readonly totalImages: number;
```

Defined in: [src/assets/image/batchOptimize.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L167)

Total number of image XObjects found.
