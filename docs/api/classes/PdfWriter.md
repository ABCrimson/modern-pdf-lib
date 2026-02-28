[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfWriter

# Class: PdfWriter

Defined in: [src/core/pdfWriter.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfWriter.ts#L116)

Serialize a PDF document to a `Uint8Array`.

```ts
const writer = new PdfWriter(registry, structure, options);
const bytes = writer.write();
```

## Constructors

### Constructor

> **new PdfWriter**(`registry`, `structure`, `options?`): `PdfWriter`

Defined in: [src/core/pdfWriter.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfWriter.ts#L124)

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

All indirect objects.

##### structure

[`DocumentStructure`](../interfaces/DocumentStructure.md)

Document structure references.

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

#### Returns

`PdfWriter`

## Methods

### write()

> **write**(): `Uint8Array`

Defined in: [src/core/pdfWriter.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfWriter.ts#L144)

Produce the complete PDF file as a `Uint8Array`.

#### Returns

`Uint8Array`

***

### writeBodyWithObjectStreams()

> **writeBodyWithObjectStreams**(`threshold`): `boolean`

Defined in: [src/core/pdfWriter.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfWriter.ts#L275)

Write the document body using object streams when the number of
eligible non-stream objects exceeds `threshold`.

#### Parameters

##### threshold

`number`

#### Returns

`boolean`

`true` if object streams (and a cross-reference stream)
         were used and the PDF is complete.  `false` if the
         threshold was not met — in that case the body has been
         written in traditional format and the caller must still
         emit the classic xref table and trailer.
