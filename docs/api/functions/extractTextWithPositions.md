[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractTextWithPositions

# Function: extractTextWithPositions()

> **extractTextWithPositions**(`operators`, `resources?`): [`TextItem`](../interfaces/TextItem.md)[]

Defined in: [src/parser/textExtractor.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/textExtractor.ts#L265)

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
