[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontEmbeddingResult

# Interface: FontEmbeddingResult

Defined in: [src/assets/font/fontEmbed.ts:509](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L509)

The complete result of building a font embedding.

## Properties

### cidFont

> `readonly` **cidFont**: [`CIDFontData`](CIDFontData.md)

Defined in: [src/assets/font/fontEmbed.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L513)

CIDFont (DescendantFont) dictionary data.

***

### cmapResult

> `readonly` **cmapResult**: [`SubsetCmap`](SubsetCmap.md)

Defined in: [src/assets/font/fontEmbed.ts:523](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L523)

Raw CMap result for advanced use.

***

### fontDescriptor

> `readonly` **fontDescriptor**: [`FontDescriptorData`](FontDescriptorData.md)

Defined in: [src/assets/font/fontEmbed.ts:515](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L515)

FontDescriptor dictionary data.

***

### fontProgram

> `readonly` **fontProgram**: `Uint8Array`

Defined in: [src/assets/font/fontEmbed.ts:519](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L519)

Subsetted (or full) font program bytes.

***

### subsetResult

> `readonly` **subsetResult**: [`SubsetResult`](SubsetResult.md)

Defined in: [src/assets/font/fontEmbed.ts:521](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L521)

Raw subset result for advanced use.

***

### toUnicodeCmap

> `readonly` **toUnicodeCmap**: `string`

Defined in: [src/assets/font/fontEmbed.ts:517](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L517)

ToUnicode CMap stream body.

***

### type0Font

> `readonly` **type0Font**: [`Type0FontData`](Type0FontData.md)

Defined in: [src/assets/font/fontEmbed.ts:511](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/assets/font/fontEmbed.ts#L511)

Top-level Type 0 font dictionary data.
