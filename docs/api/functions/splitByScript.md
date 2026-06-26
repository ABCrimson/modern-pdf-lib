[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / splitByScript

# Function: splitByScript()

> **splitByScript**(`text`): [`ScriptRun`](../interfaces/ScriptRun.md)[]

Defined in: src/assets/font/fontFallback.ts:130

Segment `text` into runs of a single Unicode script using simple range
checks. Supported scripts: Latin, Greek, Cyrillic, Arabic, Hebrew, Han,
Hiragana, Katakana, Hangul, and Common (everything else, including spaces,
digits, and punctuation).

Consecutive code points of the same script are coalesced into one run.

## Parameters

### text

`string`

The string to segment (iterated by Unicode code point).

## Returns

[`ScriptRun`](../interfaces/ScriptRun.md)[]

One [ScriptRun](../interfaces/ScriptRun.md) per maximal same-script slice, in order.
