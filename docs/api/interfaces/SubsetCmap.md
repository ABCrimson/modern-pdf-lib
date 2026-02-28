[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SubsetCmap

# Interface: SubsetCmap

Defined in: [src/assets/font/fontSubset.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/font/fontSubset.ts#L50)

A CMap mapping from CIDs (Character IDs, which correspond to new GIDs
in the subset) to Unicode codepoints.

## Properties

### cidToUnicode

> `readonly` **cidToUnicode**: `ReadonlyMap`\<`number`, `number`[]\>

Defined in: [src/assets/font/fontSubset.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/font/fontSubset.ts#L61)

Map from new GID to the Unicode codepoint(s) it represents.
For most glyphs this is a single codepoint; for ligatures it may
be multiple.

***

### cmapStream

> `readonly` **cmapStream**: `string`

Defined in: [src/assets/font/fontSubset.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/font/fontSubset.ts#L55)

The CMap as a PDF stream body string, ready to be wrapped in a
`/ToUnicode` stream object.
