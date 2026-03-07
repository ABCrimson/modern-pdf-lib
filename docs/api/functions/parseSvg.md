[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvg

# Function: parseSvg()

> **parseSvg**(`svgString`): [`SvgElement`](../interfaces/SvgElement.md)

Defined in: [src/assets/svg/svgParser.ts:864](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/svg/svgParser.ts#L864)

Parse an SVG string into an [SvgElement](../interfaces/SvgElement.md) tree.

The returned element represents the root `<svg>` element (or a
synthetic root if the input contains multiple top-level elements).

## Parameters

### svgString

`string`

## Returns

[`SvgElement`](../interfaces/SvgElement.md)
