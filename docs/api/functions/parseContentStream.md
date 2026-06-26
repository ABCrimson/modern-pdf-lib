[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseContentStream

# Function: parseContentStream()

```ts
function parseContentStream(data): ContentStreamOperator[];
```

Defined in: [src/parser/contentStreamParser.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/contentStreamParser.ts#L68)

Parse a PDF content stream into an ordered list of operators.

## Parameters

### data

`Uint8Array`

The raw content-stream bytes (already decompressed).

## Returns

[`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

An array of operators in document order.
