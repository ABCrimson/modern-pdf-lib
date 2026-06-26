[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedFontOptions

# Interface: EmbedFontOptions

Defined in: [src/core/pdfDocument.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocument.ts#L118)

Options for font embedding.

## Properties

### customName?

```ts
optional customName?: string;
```

Defined in: [src/core/pdfDocument.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocument.ts#L124)

Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name.

***

### features?

```ts
optional features?: Record<string, boolean>;
```

Defined in: [src/core/pdfDocument.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocument.ts#L122)

OpenType feature flags. e.g., &#123; kern: true, liga: true &#125;.

***

### subset?

```ts
optional subset?: boolean;
```

Defined in: [src/core/pdfDocument.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocument.ts#L120)

Whether to subset the font to reduce file size. Default: true.
