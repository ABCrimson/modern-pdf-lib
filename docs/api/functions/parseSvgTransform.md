[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgTransform

# Function: parseSvgTransform()

```ts
function parseSvgTransform(transformStr): [number, number, number, number, number, number];
```

Defined in: [src/assets/svg/svgParser.ts:309](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L309)

Parse an SVG `transform` attribute into a 2D affine matrix.

Returns `[a, b, c, d, e, f]` representing:
```
[ a  c  e ]
[ b  d  f ]
[ 0  0  1 ]
```

Supports: `matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`.
Multiple transforms are composed left-to-right.

## Parameters

### transformStr

`string`

## Returns

\[`number`, `number`, `number`, `number`, `number`, `number`\]
