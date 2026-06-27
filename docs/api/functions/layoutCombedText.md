[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutCombedText

# Function: layoutCombedText()

```ts
function layoutCombedText(text, options): object[];
```

Defined in: [src/core/layout.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/layout.ts#L94)

Layout text into evenly-spaced cells for combed text fields.

Each character is centred within its cell.  Characters beyond
`cellCount` are silently truncated.

## Parameters

### text

`string`

### options

[`LayoutCombedOptions`](../interfaces/LayoutCombedOptions.md)

## Returns

`object`[]
