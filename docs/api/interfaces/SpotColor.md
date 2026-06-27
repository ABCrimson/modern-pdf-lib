[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SpotColor

# Interface: SpotColor

Defined in: [src/core/operators/color.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L38)

A spot (Separation) colour with a named colorant and a fallback.

## Properties

### alternateColor

```ts
readonly alternateColor: 
  | RgbColor
  | CmykColor
  | GrayscaleColor;
```

Defined in: [src/core/operators/color.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L43)

Fallback colour used when the spot ink is unavailable.

***

### name

```ts
readonly name: string;
```

Defined in: [src/core/operators/color.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L41)

Colorant name, e.g. `'PANTONE 185 C'`.

***

### tint

```ts
readonly tint: number;
```

Defined in: [src/core/operators/color.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L45)

Tint value `[0, 1]` — 0 = no ink, 1 = full ink.

***

### type

```ts
readonly type: "spot";
```

Defined in: [src/core/operators/color.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L39)
