[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseSvg

# Function: parseSvg()

```ts
function parseSvg(svgString): SvgElement;
```

Defined in: [src/assets/svg/svgParser.ts:1295](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/svg/svgParser.ts#L1295)

Parse an SVG string into an [SvgElement](../interfaces/SvgElement.md) tree.

The returned element represents the root `<svg>` element (or a
synthetic root if the input contains multiple top-level elements).

## Parameters

### svgString

`string`

## Returns

[`SvgElement`](../interfaces/SvgElement.md)
