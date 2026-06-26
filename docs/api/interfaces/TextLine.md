[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextLine

# Interface: TextLine

Defined in: src/parser/textReconstruct.ts:30

A single reconstructed line of text.

## Properties

### items

> `readonly` **items**: readonly [`TextItem`](TextItem.md)[]

Defined in: src/parser/textReconstruct.ts:36

The source items that make up this line, sorted left-to-right.

***

### text

> `readonly` **text**: `string`

Defined in: src/parser/textReconstruct.ts:32

The joined text content of the line, in reading order.

***

### y

> `readonly` **y**: `number`

Defined in: src/parser/textReconstruct.ts:34

The representative baseline `y` coordinate of the line.
