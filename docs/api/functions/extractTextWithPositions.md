[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractTextWithPositions

# Function: extractTextWithPositions()

> **extractTextWithPositions**(`operators`, `resources?`): [`TextItem`](../interfaces/TextItem.md)[]

Defined in: [src/parser/textExtractor.ts:268](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/textExtractor.ts#L268)

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
