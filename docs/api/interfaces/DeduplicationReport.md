[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeduplicationReport

# Interface: DeduplicationReport

Defined in: [src/assets/image/deduplicateImages.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/deduplicateImages.ts#L26)

Report from image deduplication.

## Properties

### bytesSaved

```ts
readonly bytesSaved: number;
```

Defined in: [src/assets/image/deduplicateImages.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/deduplicateImages.ts#L34)

Estimated bytes saved by deduplication.

***

### duplicatesRemoved

```ts
readonly duplicatesRemoved: number;
```

Defined in: [src/assets/image/deduplicateImages.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/deduplicateImages.ts#L32)

Number of duplicate references replaced.

***

### totalImages

```ts
readonly totalImages: number;
```

Defined in: [src/assets/image/deduplicateImages.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/deduplicateImages.ts#L28)

Total number of image XObjects found.

***

### uniqueImages

```ts
readonly uniqueImages: number;
```

Defined in: [src/assets/image/deduplicateImages.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/deduplicateImages.ts#L30)

Number of unique images (after deduplication).
