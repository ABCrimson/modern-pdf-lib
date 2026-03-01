[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OptimizationReport

# Interface: OptimizationReport

Defined in: [src/assets/image/batchOptimize.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L96)

Summary report from batch image optimization.

## Properties

### optimizedImages

> `readonly` **optimizedImages**: `number`

Defined in: [src/assets/image/batchOptimize.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L100)

Number of images that were recompressed.

***

### optimizedTotalBytes

> `readonly` **optimizedTotalBytes**: `number`

Defined in: [src/assets/image/batchOptimize.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L104)

Total new compressed size (all images).

***

### originalTotalBytes

> `readonly` **originalTotalBytes**: `number`

Defined in: [src/assets/image/batchOptimize.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L102)

Total original compressed size (all images).

***

### perImage

> `readonly` **perImage**: readonly [`ImageOptimizeEntry`](ImageOptimizeEntry.md)[]

Defined in: [src/assets/image/batchOptimize.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L108)

Per-image details.

***

### savings

> `readonly` **savings**: `number`

Defined in: [src/assets/image/batchOptimize.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L106)

Overall savings percentage.

***

### totalImages

> `readonly` **totalImages**: `number`

Defined in: [src/assets/image/batchOptimize.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L98)

Total number of image XObjects found.
