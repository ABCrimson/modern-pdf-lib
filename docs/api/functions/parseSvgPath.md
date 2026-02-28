[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgPath

# Function: parseSvgPath()

> **parseSvgPath**(`d`): [`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]

Defined in: [src/assets/svg/svgParser.ts:305](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/svg/svgParser.ts#L305)

Parse an SVG path `d` attribute string into an array of drawing commands.

Supports all SVG path commands (absolute and relative):
M, L, H, V, C, S, Q, T, A, Z.

## Parameters

### d

`string`

## Returns

[`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]
