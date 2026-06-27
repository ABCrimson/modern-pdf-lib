[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SoftMaskBuilder

# Interface: SoftMaskBuilder

Defined in: [src/core/pdfPage.ts:602](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L602)

Builder interface for constructing soft mask content.

All drawing is in grayscale: `1` = fully opaque, `0` = fully transparent.

## Methods

### drawCircle()

```ts
drawCircle(
   cx, 
   cy, 
   radius, 
   gray): void;
```

Defined in: [src/core/pdfPage.ts:612](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L612)

Draw a filled circle at the given center with the specified radius
and grayscale value.

#### Parameters

##### cx

`number`

##### cy

`number`

##### radius

`number`

##### gray

`number`

#### Returns

`void`

***

### drawRectangle()

```ts
drawRectangle(
   x, 
   y, 
   width, 
   height, 
   gray): void;
```

Defined in: [src/core/pdfPage.ts:607](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L607)

Draw a filled rectangle at the given position with the specified
grayscale value (`0` = black/transparent, `1` = white/opaque).

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

##### gray

`number`

#### Returns

`void`

***

### pushRawOperators()

```ts
pushRawOperators(ops): void;
```

Defined in: [src/core/pdfPage.ts:616](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L616)

Append raw PDF content-stream operators to the mask.

#### Parameters

##### ops

`string`

#### Returns

`void`
