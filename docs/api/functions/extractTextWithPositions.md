[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractTextWithPositions

# Function: extractTextWithPositions()

```ts
function extractTextWithPositions(operators, resources?): TextItem[];
```

Defined in: [src/parser/textExtractor.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textExtractor.ts#L265)

Extract text with position information from a parsed content stream.

Each returned [TextItem](../interfaces/TextItem.md) includes the text string, its position
(x, y), dimensions (width, height), font size, and font name.

## Parameters

### operators

[`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

Parsed content-stream operators.

### resources?

[`PdfDict`](../classes/PdfDict.md)

Optional page `/Resources` dictionary.

## Returns

[`TextItem`](../interfaces/TextItem.md)[]

An array of positioned text items.
