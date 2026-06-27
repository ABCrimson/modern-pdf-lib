[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeTargetDimensions

# Function: computeTargetDimensions()

```ts
function computeTargetDimensions(
   imageWidth, 
   imageHeight, 
   displayWidth, 
   displayHeight, 
   maxDpi): object;
```

Defined in: [src/assets/image/dpiAnalyze.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/dpiAnalyze.ts#L90)

Compute the target pixel dimensions for downscaling an image
to a maximum DPI at a given display size.

## Parameters

### imageWidth

`number`

Current image width in pixels.

### imageHeight

`number`

Current image height in pixels.

### displayWidth

`number`

Display width in PDF points.

### displayHeight

`number`

Display height in PDF points.

### maxDpi

`number`

Maximum allowed DPI.

## Returns

`object`

Target dimensions, or the original dimensions if no
         downscaling is needed.

### downscaled

```ts
downscaled: boolean;
```

### height

```ts
height: number;
```

### width

```ts
width: number;
```
