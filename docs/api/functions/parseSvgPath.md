[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgPath

# Function: parseSvgPath()

> **parseSvgPath**(`d`): [`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]

Defined in: [src/assets/svg/svgParser.ts:288](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/assets/svg/svgParser.ts#L288)

Parse an SVG path `d` attribute string into an array of drawing commands.

Supports all SVG path commands (absolute and relative):
M, L, H, V, C, S, Q, T, A, Z.

## Parameters

### d

`string`

## Returns

[`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]
