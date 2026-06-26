[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageAnalysis

# Interface: ImageAnalysis

Defined in: [src/assets/image/compressionAnalysis.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L26)

Per-image analysis result.

## Properties

### colorSpace

```ts
readonly colorSpace: string;
```

Defined in: [src/assets/image/compressionAnalysis.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L40)

PDF color space name (e.g. 'DeviceRGB', 'DeviceGray').

***

### currentFormat

```ts
readonly currentFormat: string;
```

Defined in: [src/assets/image/compressionAnalysis.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L38)

Description of the current encoding (e.g. 'FlateDecode', 'DCTDecode').

***

### currentSize

```ts
readonly currentSize: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L36)

Size of the current (compressed) stream data in bytes.

***

### effectiveDpi

```ts
readonly effectiveDpi: number | undefined;
```

Defined in: [src/assets/image/compressionAnalysis.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L50)

Effective DPI of the image at its display size, or `undefined` if unknown.

***

### estimatedJpegSize

```ts
readonly estimatedJpegSize: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L42)

Estimated JPEG-encoded size in bytes.

***

### estimatedSavings

```ts
readonly estimatedSavings: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L44)

Estimated savings in bytes (`currentSize - estimatedJpegSize`).

***

### height

```ts
readonly height: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L34)

Image height in pixels.

***

### isGrayscale

```ts
readonly isGrayscale: boolean;
```

Defined in: [src/assets/image/compressionAnalysis.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L48)

Whether the image is effectively grayscale (even if stored as RGB).

***

### name

```ts
readonly name: string;
```

Defined in: [src/assets/image/compressionAnalysis.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L28)

Resource name on the page (e.g. '/Im1').

***

### pageIndex

```ts
readonly pageIndex: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L30)

Zero-based page index where this image appears.

***

### recommendation

```ts
readonly recommendation: "grayscale" | "recompress" | "keep" | "downscale";
```

Defined in: [src/assets/image/compressionAnalysis.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L52)

Recommended action for this image.

***

### savingsPercent

```ts
readonly savingsPercent: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L46)

Savings as a percentage of the current size.

***

### width

```ts
readonly width: number;
```

Defined in: [src/assets/image/compressionAnalysis.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/compressionAnalysis.ts#L32)

Image width in pixels.
