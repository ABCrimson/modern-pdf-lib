[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setGraphicsStateOp

# Function: setGraphicsStateOp()

> **setGraphicsStateOp**(`name`): `string`

Defined in: [src/core/operators/state.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/state.ts#L199)

Set the graphics state dictionary (`gs`).

The `name` must refer to an entry in the page's `/Resources /ExtGState`
dictionary.

## Parameters

### name

`string`

Graphics-state resource name (e.g. `GS1`).

## Returns

`string`
