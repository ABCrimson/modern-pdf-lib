[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ContentStreamOperator

# Interface: ContentStreamOperator

Defined in: [src/parser/contentStreamParser.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/contentStreamParser.ts#L39)

A parsed content-stream operator with its preceding operands.

## Properties

### operands

> **operands**: [`Operand`](../type-aliases/Operand.md)[]

Defined in: [src/parser/contentStreamParser.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/contentStreamParser.ts#L43)

The operand values that preceded this operator.

***

### operator

> **operator**: `string`

Defined in: [src/parser/contentStreamParser.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/contentStreamParser.ts#L41)

The operator keyword, e.g. `"BT"`, `"Tf"`, `"Tj"`, `"re"`, `"cm"`.
