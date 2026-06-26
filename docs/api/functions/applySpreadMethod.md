[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applySpreadMethod

# Function: applySpreadMethod()

```ts
function applySpreadMethod(t, method): number;
```

Defined in: [src/assets/svg/svgParser.ts:1186](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/svg/svgParser.ts#L1186)

Apply `spreadMethod` to a gradient parameter `t` outside [0, 1].

- `pad`: clamp to [0, 1]
- `reflect`: mirror at boundaries (0-&gt;1-&gt;0-&gt;1...)
- `repeat`: wrap around (0-&gt;1, 0-&gt;1, ...)

## Parameters

### t

`number`

### method

`"pad"` \| `"reflect"` \| `"repeat"`

## Returns

`number`
