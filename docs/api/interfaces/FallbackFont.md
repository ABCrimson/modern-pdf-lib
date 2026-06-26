[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FallbackFont

# Interface: FallbackFont

Defined in: src/assets/font/fontFallback.ts:26

A candidate font in a fallback chain. The [covers](#covers) predicate reports
whether the font can render a given Unicode code point.

## Properties

### covers

> `readonly` **covers**: (`codepoint`) => `boolean`

Defined in: src/assets/font/fontFallback.ts:30

Returns `true` if this font can render the given Unicode code point.

#### Parameters

##### codepoint

`number`

#### Returns

`boolean`

***

### name

> `readonly` **name**: `string`

Defined in: src/assets/font/fontFallback.ts:28

Human-readable font identifier returned in [FallbackRun.font](FallbackRun.md#font).
