[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setGraphicsStateOp

# Function: setGraphicsStateOp()

> **setGraphicsStateOp**(`name`): `string`

Defined in: [src/core/operators/state.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/operators/state.ts#L199)

Set the graphics state dictionary (`gs`).

The `name` must refer to an entry in the page's `/Resources /ExtGState`
dictionary.

## Parameters

### name

`string`

Graphics-state resource name (e.g. `GS1`).

## Returns

`string`
