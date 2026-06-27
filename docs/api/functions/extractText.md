[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractText

# Function: extractText()

```ts
function extractText(
   operators, 
   resources?, 
   options?): string;
```

Defined in: [src/parser/textExtractor.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L76)

Extract plain text from a sequence of parsed content-stream operators.

This function concatenates all text-showing operator strings, inserting
spaces between text objects (BT/ET blocks) and newlines at line breaks
(`T*`, `Td`, `TD`).

## Parameters

### operators

[`ContentStreamOperator`](../interfaces/ContentStreamOperator.md)[]

Parsed content-stream operators.

### resources?

[`PdfDict`](../classes/PdfDict.md)

Optional page `/Resources` dictionary (used to look
                   up font encodings and ToUnicode CMaps).

### options?

[`TextExtractionOptions`](../interfaces/TextExtractionOptions.md)

Extraction options.

## Returns

`string`

The extracted text as a single string.
