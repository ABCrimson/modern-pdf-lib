[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DeduplicationReport

# Interface: DeduplicationReport

Defined in: [src/assets/image/deduplicateImages.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/deduplicateImages.ts#L28)

Report from image deduplication.

## Properties

### bytesSaved

> `readonly` **bytesSaved**: `number`

Defined in: [src/assets/image/deduplicateImages.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/deduplicateImages.ts#L36)

Estimated bytes saved by deduplication.

***

### duplicatesRemoved

> `readonly` **duplicatesRemoved**: `number`

Defined in: [src/assets/image/deduplicateImages.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/deduplicateImages.ts#L34)

Number of duplicate references replaced.

***

### totalImages

> `readonly` **totalImages**: `number`

Defined in: [src/assets/image/deduplicateImages.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/deduplicateImages.ts#L30)

Total number of image XObjects found.

***

### uniqueImages

> `readonly` **uniqueImages**: `number`

Defined in: [src/assets/image/deduplicateImages.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/deduplicateImages.ts#L32)

Number of unique images (after deduplication).
