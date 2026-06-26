[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvgPath

# Function: parseSvgPath()

```ts
function parseSvgPath(d): SvgDrawCommand[];
```

Defined in: [src/assets/svg/svgParser.ts:415](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/svg/svgParser.ts#L415)

Parse an SVG path `d` attribute string into an array of drawing commands.

Supports all SVG path commands (absolute and relative):
M, L, H, V, C, S, Q, T, A, Z.

## Parameters

### d

`string`

## Returns

[`SvgDrawCommand`](../interfaces/SvgDrawCommand.md)[]
