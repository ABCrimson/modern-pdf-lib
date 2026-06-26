[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setGraphicsStateOp

# Function: setGraphicsStateOp()

```ts
function setGraphicsStateOp(name): string;
```

Defined in: [src/core/operators/state.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/state.ts#L199)

Set the graphics state dictionary (`gs`).

The `name` must refer to an entry in the page's `/Resources /ExtGState`
dictionary.

## Parameters

### name

`string`

Graphics-state resource name (e.g. `GS1`).

## Returns

`string`
