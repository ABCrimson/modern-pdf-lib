[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedPageOptions

# Interface: EmbedPageOptions

Defined in: [src/core/pdfEmbed.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L106)

Options for embedding a page as a Form XObject.

## Properties

### boundingBox?

```ts
optional boundingBox?: object;
```

Defined in: [src/core/pdfEmbed.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L111)

Clip the embedded page to a sub-region (bounding box).
Coordinates are in the source page's coordinate system.

#### height

```ts
height: number;
```

#### width

```ts
width: number;
```

#### x

```ts
x: number;
```

#### y

```ts
y: number;
```

***

### transformationMatrix?

```ts
optional transformationMatrix?: [number, number, number, number, number, number];
```

Defined in: [src/core/pdfEmbed.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L123)

Apply an affine transformation matrix to the Form XObject.
The six values correspond to `[a, b, c, d, tx, ty]` in the
standard 3x3 PDF transformation matrix.
