[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ScriptRun

# Interface: ScriptRun

Defined in: src/assets/font/fontFallback.ts:48

A contiguous slice of the input text belonging to a single Unicode script.

## Properties

### script

> `readonly` **script**: `string`

Defined in: src/assets/font/fontFallback.ts:50

Script name (e.g. `'Latin'`, `'Han'`, `'Common'`).

***

### start

> `readonly` **start**: `number`

Defined in: src/assets/font/fontFallback.ts:54

Code-point index (not UTF-16 index) where this run starts.

***

### text

> `readonly` **text**: `string`

Defined in: src/assets/font/fontFallback.ts:52

The text covered by this run.
