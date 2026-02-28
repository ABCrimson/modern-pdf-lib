[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractText

# Function: extractText()

> **extractText**(`operators`, `resources?`, `options?`): `string`

Defined in: [src/parser/textExtractor.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/parser/textExtractor.ts#L76)

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

`TextExtractionOptions`

Extraction options.

## Returns

`string`

The extracted text as a single string.
