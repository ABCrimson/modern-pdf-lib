[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExponentialFunction

# Interface: ExponentialFunction

Defined in: src/core/pdfFunctions.ts:68

Type 2 — exponential interpolation function (ISO 32000-2 §7.10.3).

Defines `out[i] = C0[i] + x^N · (C1[i] − C0[i])` for a single clamped
input `x`.

## Properties

### c0?

> `readonly` `optional` **c0?**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:73

Output values at `x = 0`; defaults to `[0]`.

***

### c1?

> `readonly` `optional` **c1?**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:75

Output values at `x = 1`; defaults to `[1]`.

***

### domain

> `readonly` **domain**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:71

Input domain `[min max]` for the single input.

***

### functionType

> `readonly` **functionType**: `2`

Defined in: src/core/pdfFunctions.ts:69

***

### n

> `readonly` **n**: `number`

Defined in: src/core/pdfFunctions.ts:77

Interpolation exponent `N`.
