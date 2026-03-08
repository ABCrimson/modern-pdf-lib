[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgTransform

# Function: parseSvgTransform()

> **parseSvgTransform**(`transformStr`): \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/assets/svg/svgParser.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/svg/svgParser.ts#L199)

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
