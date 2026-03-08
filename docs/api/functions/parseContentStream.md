[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseContentStream

# Function: parseContentStream()

> **parseContentStream**(`data`): [`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

Defined in: [src/parser/contentStreamParser.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/parser/contentStreamParser.ts#L68)

Parse a PDF content stream into an ordered list of operators.

## Parameters

### data

`Uint8Array`

The raw content-stream bytes (already decompressed).

## Returns

[`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

An array of operators in document order.
