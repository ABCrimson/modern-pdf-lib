[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutCombedText

# Function: layoutCombedText()

```ts
function layoutCombedText(text, options): object[];
```

Defined in: [src/core/layout.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L94)

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
