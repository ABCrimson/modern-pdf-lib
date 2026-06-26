[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyStrokeColor

# Function: applyStrokeColor()

```ts
function applyStrokeColor(color): string;
```

Defined in: [src/core/operators/color.ts:438](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L438)

Emit the appropriate stroke-colour operator for a [Color](../type-aliases/Color.md) value.

For spot colours, emits a `CS` (set stroking colour space) followed
by `SCN` (set stroking colour in current space).

For DeviceN colours, emits `CS` + `SCN` with the tint values.

## Parameters

### color

[`Color`](../type-aliases/Color.md)

## Returns

`string`
