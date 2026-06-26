[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applySpreadMethod

# Function: applySpreadMethod()

> **applySpreadMethod**(`t`, `method`): `number`

Defined in: [src/assets/svg/svgParser.ts:1186](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L1186)

Apply `spreadMethod` to a gradient parameter `t` outside [0, 1].

- `pad`: clamp to [0, 1]
- `reflect`: mirror at boundaries (0->1->0->1...)
- `repeat`: wrap around (0->1, 0->1, ...)

## Parameters

### t

`number`

### method

`"pad"` \| `"reflect"` \| `"repeat"`

## Returns

`number`
