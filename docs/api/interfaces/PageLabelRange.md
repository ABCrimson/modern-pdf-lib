[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageLabelRange

# Interface: PageLabelRange

Defined in: src/core/pageLabels.ts:52

Defines a contiguous range of pages that share a labelling scheme.

Each range starts at `startPage` (zero-based page index) and extends
to the next range's `startPage` (or the end of the document).

## Properties

### prefix?

> `optional` **prefix**: `string`

Defined in: src/core/pageLabels.ts:67

An optional prefix string prepended to each page label.
For example, `"A-"` produces labels like "A-1", "A-2", etc.

***

### start?

> `optional` **start**: `number`

Defined in: src/core/pageLabels.ts:76

The numeric value of the first page label in this range.
Defaults to `1`.

For example, `{ startPage: 4, style: 'decimal', start: 5 }` means
page index 4 is labelled "5", page index 5 is labelled "6", etc.

***

### startPage

> **startPage**: `number`

Defined in: src/core/pageLabels.ts:56

Zero-based index of the first page this label range applies to.

***

### style

> **style**: [`PageLabelStyle`](../type-aliases/PageLabelStyle.md)

Defined in: src/core/pageLabels.ts:61

The numbering style for this range.
