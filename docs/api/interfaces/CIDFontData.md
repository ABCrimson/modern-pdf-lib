[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CIDFontData

# Interface: CIDFontData

Defined in: [src/assets/font/fontEmbed.ts:479](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/font/fontEmbed.ts#L479)

Data for the CIDFont (DescendantFont) dictionary.

## Properties

### baseFont

> `readonly` **baseFont**: `string`

Defined in: [src/assets/font/fontEmbed.ts:481](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/font/fontEmbed.ts#L481)

***

### cidSystemInfo

> `readonly` **cidSystemInfo**: [`CIDSystemInfoData`](CIDSystemInfoData.md)

Defined in: [src/assets/font/fontEmbed.ts:482](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/font/fontEmbed.ts#L482)

***

### defaultWidth

> `readonly` **defaultWidth**: `number`

Defined in: [src/assets/font/fontEmbed.ts:489](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/font/fontEmbed.ts#L489)

***

### subtype

> `readonly` **subtype**: `"CIDFontType2"`

Defined in: [src/assets/font/fontEmbed.ts:480](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/font/fontEmbed.ts#L480)

***

### wArray

> `readonly` **wArray**: readonly [`WidthEntry`](../type-aliases/WidthEntry.md)[]

Defined in: [src/assets/font/fontEmbed.ts:488](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/font/fontEmbed.ts#L488)

The /W (widths) array entries.  Each entry is either:
- `[cid, [w1, w2, ...]]` — individual widths starting at `cid`
- `[cidFirst, cidLast, width]` — range with uniform width
