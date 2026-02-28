[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvg

# Function: parseSvg()

> **parseSvg**(`svgString`): [`SvgElement`](../interfaces/SvgElement.md)

Defined in: [src/assets/svg/svgParser.ts:847](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/assets/svg/svgParser.ts#L847)

Parse an SVG string into an [SvgElement](../interfaces/SvgElement.md) tree.

The returned element represents the root `<svg>` element (or a
synthetic root if the input contains multiple top-level elements).

## Parameters

### svgString

`string`

## Returns

[`SvgElement`](../interfaces/SvgElement.md)
