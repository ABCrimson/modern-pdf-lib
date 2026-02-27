[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseContentStream

# Function: parseContentStream()

> **parseContentStream**(`data`): [`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

Defined in: [src/parser/contentStreamParser.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/contentStreamParser.ts#L68)

Parse a PDF content stream into an ordered list of operators.

## Parameters

### data

`Uint8Array`

The raw content-stream bytes (already decompressed).

## Returns

[`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

An array of operators in document order.
