[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgColor

# Function: parseSvgColor()

> **parseSvgColor**(`colorStr`): \{ `a?`: `number`; `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

Defined in: [src/assets/svg/svgParser.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/assets/svg/svgParser.ts#L115)

Parse an SVG colour string into an RGB object.

Supported formats:
- `#rgb`
- `#rrggbb`
- `rgb(r, g, b)` (0-255)
- `rgba(r, g, b, a)` (a: 0-1)
- Named colours (basic set)

## Parameters

### colorStr

`string`

## Returns

\{ `a?`: `number`; `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

RGB values (0-255) or `undefined` if not parseable.
