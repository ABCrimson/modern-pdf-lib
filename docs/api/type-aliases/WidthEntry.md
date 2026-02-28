[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WidthEntry

# Type Alias: WidthEntry

> **WidthEntry** = \{ `kind`: `"individual"`; `start`: `number`; `widths`: readonly `number`[]; \} \| \{ `first`: `number`; `kind`: `"range"`; `last`: `number`; `width`: `number`; \}

Defined in: [src/assets/font/fontEmbed.ts:494](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L494)

An entry in the CIDFont /W array.

Format 1: `{ start, widths }` — individual widths for consecutive CIDs.
Format 2: `{ first, last, width }` — range with uniform width.
