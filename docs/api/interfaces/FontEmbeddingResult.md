[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontEmbeddingResult

# Interface: FontEmbeddingResult

Defined in: [src/assets/font/fontEmbed.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L513)

The complete result of building a font embedding.

## Properties

### cidFont

```ts
readonly cidFont: CIDFontData;
```

Defined in: [src/assets/font/fontEmbed.ts:517](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L517)

CIDFont (DescendantFont) dictionary data.

***

### cmapResult

```ts
readonly cmapResult: SubsetCmap;
```

Defined in: [src/assets/font/fontEmbed.ts:527](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L527)

Raw CMap result for advanced use.

***

### fontDescriptor

```ts
readonly fontDescriptor: FontDescriptorData;
```

Defined in: [src/assets/font/fontEmbed.ts:519](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L519)

FontDescriptor dictionary data.

***

### fontProgram

```ts
readonly fontProgram: Uint8Array;
```

Defined in: [src/assets/font/fontEmbed.ts:523](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L523)

Subsetted (or full) font program bytes.

***

### subsetResult

```ts
readonly subsetResult: SubsetResult;
```

Defined in: [src/assets/font/fontEmbed.ts:525](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L525)

Raw subset result for advanced use.

***

### toUnicodeCmap

```ts
readonly toUnicodeCmap: string;
```

Defined in: [src/assets/font/fontEmbed.ts:521](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L521)

ToUnicode CMap stream body.

***

### type0Font

```ts
readonly type0Font: Type0FontData;
```

Defined in: [src/assets/font/fontEmbed.ts:515](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L515)

Top-level Type 0 font dictionary data.
