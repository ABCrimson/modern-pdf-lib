[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageOptimizeEntry

# Interface: ImageOptimizeEntry

Defined in: [src/assets/image/batchOptimize.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L145)

Per-image optimization report entry.

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/assets/image/batchOptimize.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L147)

Resource name (e.g. '/Im1').

***

### newSize

```ts
readonly newSize: number;
```

Defined in: [src/assets/image/batchOptimize.ts:153](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L153)

New compressed size in bytes (same as original if skipped).

***

### originalSize

```ts
readonly originalSize: number;
```

Defined in: [src/assets/image/batchOptimize.ts:151](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L151)

Original compressed size in bytes.

***

### pageIndex

```ts
readonly pageIndex: number;
```

Defined in: [src/assets/image/batchOptimize.ts:149](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L149)

Page index where this image appears.

***

### reason?

```ts
readonly optional reason?: string;
```

Defined in: [src/assets/image/batchOptimize.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L159)

Reason for skipping, if applicable.

***

### skipped

```ts
readonly skipped: boolean;
```

Defined in: [src/assets/image/batchOptimize.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L155)

Whether this image was skipped.

***

### skippedByFilter

```ts
readonly skippedByFilter: boolean;
```

Defined in: [src/assets/image/batchOptimize.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L157)

Whether this image was skipped due to a selective filter.
