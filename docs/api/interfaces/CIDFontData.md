[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CIDFontData

# Interface: CIDFontData

Defined in: [src/assets/font/fontEmbed.ts:475](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontEmbed.ts#L475)

Data for the CIDFont (DescendantFont) dictionary.

## Properties

### baseFont

> `readonly` **baseFont**: `string`

Defined in: [src/assets/font/fontEmbed.ts:477](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontEmbed.ts#L477)

***

### cidSystemInfo

> `readonly` **cidSystemInfo**: [`CIDSystemInfoData`](CIDSystemInfoData.md)

Defined in: [src/assets/font/fontEmbed.ts:478](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontEmbed.ts#L478)

***

### defaultWidth

> `readonly` **defaultWidth**: `number`

Defined in: [src/assets/font/fontEmbed.ts:485](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontEmbed.ts#L485)

***

### subtype

> `readonly` **subtype**: `"CIDFontType2"`

Defined in: [src/assets/font/fontEmbed.ts:476](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontEmbed.ts#L476)

***

### wArray

> `readonly` **wArray**: readonly [`WidthEntry`](../type-aliases/WidthEntry.md)[]

Defined in: [src/assets/font/fontEmbed.ts:484](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/font/fontEmbed.ts#L484)

The /W (widths) array entries.  Each entry is either:
- `[cid, [w1, w2, ...]]` — individual widths starting at `cid`
- `[cidFirst, cidLast, width]` — range with uniform width
