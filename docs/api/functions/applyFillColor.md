[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyFillColor

# Function: applyFillColor()

```ts
function applyFillColor(color): string;
```

Defined in: [src/core/operators/color.ts:415](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L415)

Emit the appropriate fill-colour operator for a [Color](../type-aliases/Color.md) value.

For spot colours, emits a `cs` (set colour space) followed by `scn`
(set colour in current space) using the spot colour's resource name.
The caller must ensure the Separation colour space is registered as
a page resource with the matching name.

For DeviceN colours, emits `cs` + `scn` with the tint values.

## Parameters

### color

[`Color`](../type-aliases/Color.md)

## Returns

`string`
