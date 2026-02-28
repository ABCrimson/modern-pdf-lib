[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgPath

# Function: parseSvgPath()

> **parseSvgPath**(`d`): [`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]

Defined in: [src/assets/svg/svgParser.ts:288](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/assets/svg/svgParser.ts#L288)

Parse an SVG path `d` attribute string into an array of drawing commands.

Supports all SVG path commands (absolute and relative):
M, L, H, V, C, S, Q, T, A, Z.

## Parameters

### d

`string`

## Returns

[`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]
