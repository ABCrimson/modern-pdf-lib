[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ProgressInfo

# Interface: ProgressInfo

Defined in: [src/assets/image/batchOptimize.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L28)

Progress information passed to the `onProgress` callback.

## Properties

### current

```ts
readonly current: number;
```

Defined in: [src/assets/image/batchOptimize.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L30)

1-based index of the current image being processed.

***

### imageName

```ts
readonly imageName: string;
```

Defined in: [src/assets/image/batchOptimize.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L34)

Resource name of the current image (e.g., '/Im1').

***

### pageIndex

```ts
readonly pageIndex: number;
```

Defined in: [src/assets/image/batchOptimize.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L36)

Page index (0-based) where the image appears.

***

### savedBytes

```ts
readonly savedBytes: number;
```

Defined in: [src/assets/image/batchOptimize.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L38)

Bytes saved for this image (negative if image grew).

***

### skipped

```ts
readonly skipped: boolean;
```

Defined in: [src/assets/image/batchOptimize.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L42)

Whether this image was skipped (by filter or incompatibility).

***

### total

```ts
readonly total: number;
```

Defined in: [src/assets/image/batchOptimize.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L32)

Total number of images to process.

***

### totalSavedBytes

```ts
readonly totalSavedBytes: number;
```

Defined in: [src/assets/image/batchOptimize.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/batchOptimize.ts#L40)

Cumulative bytes saved so far.
