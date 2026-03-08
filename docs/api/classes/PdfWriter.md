[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfWriter

# Class: PdfWriter

Defined in: [src/core/pdfWriter.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L118)

Serialize a PDF document to a `Uint8Array`.

```ts
const writer = new PdfWriter(registry, structure, options);
const bytes = writer.write();
```

## Constructors

### Constructor

> **new PdfWriter**(`registry`, `structure`, `options?`, `encryptionHandler?`): `PdfWriter`

Defined in: [src/core/pdfWriter.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L133)

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

All indirect objects.

##### structure

[`DocumentStructure`](../interfaces/DocumentStructure.md)

Document structure references.

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

##### encryptionHandler?

[`PdfEncryptionHandler`](PdfEncryptionHandler.md)

#### Returns

`PdfWriter`

## Methods

### write()

> **write**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/pdfWriter.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L159)

Produce the complete PDF file as a `Uint8Array`.

When an encryption handler is present, all string and stream
objects are encrypted and the /Encrypt dictionary + /ID array
are added to the trailer.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### writeBodyWithObjectStreams()

> **writeBodyWithObjectStreams**(`threshold`): `Promise`\<`boolean`\>

Defined in: [src/core/pdfWriter.ts:384](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L384)

Write the document body using object streams when the number of
eligible non-stream objects exceeds `threshold`.

#### Parameters

##### threshold

`number`

#### Returns

`Promise`\<`boolean`\>

`true` if object streams (and a cross-reference stream)
         were used and the PDF is complete.  `false` if the
         threshold was not met — in that case the body has been
         written in traditional format and the caller must still
         emit the classic xref table and trailer.
