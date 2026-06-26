[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageLabelRange

# Interface: PageLabelRange

Defined in: [src/core/pageLabels.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L52)

Defines a contiguous range of pages that share a labelling scheme.

Each range starts at `startPage` (zero-based page index) and extends
to the next range's `startPage` (or the end of the document).

## Properties

### prefix?

```ts
optional prefix?: string;
```

Defined in: [src/core/pageLabels.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L67)

An optional prefix string prepended to each page label.
For example, `"A-"` produces labels like "A-1", "A-2", etc.

***

### start?

```ts
optional start?: number;
```

Defined in: [src/core/pageLabels.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L76)

The numeric value of the first page label in this range.
Defaults to `1`.

For example, `{ startPage: 4, style: 'decimal', start: 5 }` means
page index 4 is labelled "5", page index 5 is labelled "6", etc.

***

### startPage

```ts
startPage: number;
```

Defined in: [src/core/pageLabels.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L56)

Zero-based index of the first page this label range applies to.

***

### style

```ts
style: PageLabelStyle;
```

Defined in: [src/core/pageLabels.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageLabels.ts#L61)

The numbering style for this range.
