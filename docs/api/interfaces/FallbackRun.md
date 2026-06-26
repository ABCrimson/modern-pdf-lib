[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FallbackRun

# Interface: FallbackRun

Defined in: src/assets/font/fontFallback.ts:36

A contiguous slice of the input text that resolves to a single font.

## Properties

### font

> `readonly` **font**: `string`

Defined in: src/assets/font/fontFallback.ts:38

Name of the font chosen for every code point in this run.

***

### start

> `readonly` **start**: `number`

Defined in: src/assets/font/fontFallback.ts:42

Code-point index (not UTF-16 index) where this run starts.

***

### text

> `readonly` **text**: `string`

Defined in: src/assets/font/fontFallback.ts:40

The text covered by this run (may include astral characters).
