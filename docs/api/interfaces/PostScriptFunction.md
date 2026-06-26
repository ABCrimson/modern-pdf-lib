[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PostScriptFunction

# Interface: PostScriptFunction

Defined in: src/core/pdfFunctions.ts:104

Type 4 — PostScript calculator function (ISO 32000-2 §7.10.5).

`source` is the PostScript program including its enclosing `{ … }`.

## Properties

### domain

> `readonly` **domain**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:107

Input domain `[min0 max0 …]`, two entries per input.

***

### functionType

> `readonly` **functionType**: `4`

Defined in: src/core/pdfFunctions.ts:105

***

### range

> `readonly` **range**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:109

Output range `[min0 max0 …]`, two entries per output component.

***

### source

> `readonly` **source**: `string`

Defined in: src/core/pdfFunctions.ts:111

The PostScript calculator source, including the outer braces.
