[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SvgDrawCommand

# Interface: SvgDrawCommand

Defined in: [src/assets/svg/svgParser.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L23)

A single drawing command produced from an SVG element.

## Properties

### params

```ts
params: number[];
```

Defined in: [src/assets/svg/svgParser.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L34)

***

### type

```ts
type: 
  | "moveTo"
  | "lineTo"
  | "curveTo"
  | "quadCurveTo"
  | "closePath"
  | "rect"
  | "circle"
  | "ellipse"
  | "arc";
```

Defined in: [src/assets/svg/svgParser.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L24)
