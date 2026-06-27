[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JpegMetadata

# Interface: JpegMetadata

Defined in: [src/assets/image/imageMetadata.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/imageMetadata.ts#L28)

Extracted JPEG metadata from APP markers.

## Properties

### appMarkers

```ts
readonly appMarkers: readonly Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/assets/image/imageMetadata.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/imageMetadata.ts#L38)

Raw APP marker segments to preserve (excluding APP2/ICC).

***

### copyright?

```ts
readonly optional copyright?: string;
```

Defined in: [src/assets/image/imageMetadata.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/imageMetadata.ts#L36)

Copyright string from EXIF.

***

### dpiX?

```ts
readonly optional dpiX?: number;
```

Defined in: [src/assets/image/imageMetadata.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/imageMetadata.ts#L32)

Horizontal DPI from EXIF or JFIF.

***

### dpiY?

```ts
readonly optional dpiY?: number;
```

Defined in: [src/assets/image/imageMetadata.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/imageMetadata.ts#L34)

Vertical DPI from EXIF or JFIF.

***

### orientation?

```ts
readonly optional orientation?: number;
```

Defined in: [src/assets/image/imageMetadata.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/imageMetadata.ts#L30)

EXIF orientation tag (1-8). 1 = normal, 6 = rotated 90 CW, etc.
