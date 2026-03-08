[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AnalyzeImagesOptions

# Interface: AnalyzeImagesOptions

Defined in: [src/assets/image/compressionAnalysis.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/compressionAnalysis.ts#L78)

Options for `analyzeImages()`.

## Properties

### maxDpi?

> `readonly` `optional` **maxDpi**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/compressionAnalysis.ts#L91)

Maximum allowed DPI.  Images exceeding this at their display size
receive a `'downscale'` recommendation.

Default: `150`.

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/compressionAnalysis.ts#L84)

JPEG quality used for size estimation (1–100).

Default: `80`.
