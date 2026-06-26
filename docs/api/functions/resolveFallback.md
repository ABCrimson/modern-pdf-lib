[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / resolveFallback

# Function: resolveFallback()

```ts
function resolveFallback(text, fonts): FallbackRun[];
```

Defined in: [src/assets/font/fontFallback.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L70)

Resolve a fallback chain over `text`, code point by code point.

For each code point the FIRST font in `fonts` whose `covers()` returns true
is selected. The final font in the list is treated as the ultimate fallback
and is used even when its `covers()` returns false, guaranteeing every code
point is assigned. Consecutive code points using the same font are coalesced
into a single [FallbackRun](../interfaces/FallbackRun.md).

## Parameters

### text

`string`

The string to resolve (iterated by Unicode code point).

### fonts

readonly [`FallbackFont`](../interfaces/FallbackFont.md)[]

Ordered fallback chain; the last entry is the ultimate fallback.

## Returns

[`FallbackRun`](../interfaces/FallbackRun.md)[]

One run per maximal same-font slice, in document order.
