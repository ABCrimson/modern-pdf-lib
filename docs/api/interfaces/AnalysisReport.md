[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AnalysisReport

# Interface: AnalysisReport

Defined in: [src/assets/image/compressionAnalysis.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L58)

Full document analysis report.

## Properties

### images

```ts
readonly images: readonly ImageAnalysis[];
```

Defined in: [src/assets/image/compressionAnalysis.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L60)

Per-image analysis results.

***

### totalCurrentSize

```ts
readonly totalCurrentSize: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L62)

Total size of all image streams in bytes.

***

### totalEstimatedSize

```ts
readonly totalEstimatedSize: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L64)

Total estimated size after optimization.

***

### totalSavings

```ts
readonly totalSavings: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L66)

Total estimated savings in bytes.

***

### totalSavingsPercent

```ts
readonly totalSavingsPercent: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L68)

Total savings as a percentage of total current size.
