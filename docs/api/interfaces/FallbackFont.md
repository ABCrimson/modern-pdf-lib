[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FallbackFont

# Interface: FallbackFont

Defined in: [src/assets/font/fontFallback.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontFallback.ts#L26)

A candidate font in a fallback chain. The [covers](#covers) predicate reports
whether the font can render a given Unicode code point.

## Properties

### covers

```ts
readonly covers: (codepoint) => boolean;
```

Defined in: [src/assets/font/fontFallback.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontFallback.ts#L30)

Returns `true` if this font can render the given Unicode code point.

#### Parameters

##### codepoint

`number`

#### Returns

`boolean`

***

### name

```ts
readonly name: string;
```

Defined in: [src/assets/font/fontFallback.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontFallback.ts#L28)

Human-readable font identifier returned in [FallbackRun.font](FallbackRun.md#font).
