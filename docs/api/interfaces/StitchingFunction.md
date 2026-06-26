[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StitchingFunction

# Interface: StitchingFunction

Defined in: src/core/pdfFunctions.ts:87

Type 3 — stitching function (ISO 32000-2 §7.10.4).

A 1-input function whose domain is split into `k` subdomains by `bounds`;
each subdomain dispatches to one of `functions`, after re-encoding the
input into that sub-function's domain via `encode`.

## Properties

### bounds

> `readonly` **bounds**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:94

The `k − 1` interior boundary values, strictly increasing.

***

### domain

> `readonly` **domain**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:90

Input domain `[min max]`.

***

### encode

> `readonly` **encode**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:96

`2k` encode values mapping each subdomain to its sub-function domain.

***

### functions

> `readonly` **functions**: readonly [`PdfFunctionDef`](../type-aliases/PdfFunctionDef.md)[]

Defined in: src/core/pdfFunctions.ts:92

The `k` sub-functions.

***

### functionType

> `readonly` **functionType**: `3`

Defined in: src/core/pdfFunctions.ts:88
