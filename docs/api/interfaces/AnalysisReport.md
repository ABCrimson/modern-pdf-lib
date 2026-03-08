[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AnalysisReport

# Interface: AnalysisReport

Defined in: [src/assets/image/compressionAnalysis.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/compressionAnalysis.ts#L58)

Full document analysis report.

## Properties

### images

> `readonly` **images**: readonly [`ImageAnalysis`](ImageAnalysis.md)[]

Defined in: [src/assets/image/compressionAnalysis.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/compressionAnalysis.ts#L60)

Per-image analysis results.

***

### totalCurrentSize

> `readonly` **totalCurrentSize**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/compressionAnalysis.ts#L62)

Total size of all image streams in bytes.

***

### totalEstimatedSize

> `readonly` **totalEstimatedSize**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/compressionAnalysis.ts#L64)

Total estimated size after optimization.

***

### totalSavings

> `readonly` **totalSavings**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/compressionAnalysis.ts#L66)

Total estimated savings in bytes.

***

### totalSavingsPercent

> `readonly` **totalSavingsPercent**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/compressionAnalysis.ts#L68)

Total savings as a percentage of total current size.
