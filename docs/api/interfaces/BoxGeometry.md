[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BoxGeometry

# Interface: BoxGeometry

Defined in: [src/compliance/pdfX6.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L58)

Page-geometry boxes relevant to PDF/X conformance.

## Properties

### bleedBox?

```ts
readonly optional bleedBox?: PdfRect;
```

Defined in: [src/compliance/pdfX6.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L64)

The bleed box — the region painted then trimmed away.

***

### mediaBox

```ts
readonly mediaBox: PdfRect;
```

Defined in: [src/compliance/pdfX6.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L60)

The media box — the physical medium bounds. Required.

***

### trimBox?

```ts
readonly optional trimBox?: PdfRect;
```

Defined in: [src/compliance/pdfX6.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L62)

The trim box — the intended finished page bounds.
