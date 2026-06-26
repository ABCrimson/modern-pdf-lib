[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BoxGeometry

# Interface: BoxGeometry

Defined in: src/compliance/pdfX6.ts:58

Page-geometry boxes relevant to PDF/X conformance.

## Properties

### bleedBox?

> `readonly` `optional` **bleedBox?**: [`PdfRect`](../type-aliases/PdfRect.md)

Defined in: src/compliance/pdfX6.ts:64

The bleed box — the region painted then trimmed away.

***

### mediaBox

> `readonly` **mediaBox**: [`PdfRect`](../type-aliases/PdfRect.md)

Defined in: src/compliance/pdfX6.ts:60

The media box — the physical medium bounds. Required.

***

### trimBox?

> `readonly` `optional` **trimBox?**: [`PdfRect`](../type-aliases/PdfRect.md)

Defined in: src/compliance/pdfX6.ts:62

The trim box — the intended finished page bounds.
