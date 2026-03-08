[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfSaveOptions

# Interface: PdfSaveOptions

Defined in: [src/core/pdfWriter.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L32)

Options that control how the PDF is written.

## Properties

### addDefaultPage?

> `optional` **addDefaultPage**: `boolean`

Defined in: [src/core/pdfWriter.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L58)

Add a blank page if the document has no pages. Default: `true`.

***

### compress?

> `optional` **compress**: `boolean`

Defined in: [src/core/pdfWriter.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L34)

Apply FlateDecode compression to streams.  Default: `true`.

***

### compressionLevel?

> `optional` **compressionLevel**: `1` \| `6` \| `3` \| `2` \| `4` \| `5` \| `7` \| `8` \| `9`

Defined in: [src/core/pdfWriter.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L39)

Compression level for FlateDecode (1–9).  Default: `6`.
Ignored when `compress` is `false`.

***

### objectStreamThreshold?

> `optional` **objectStreamThreshold**: `number`

Defined in: [src/core/pdfWriter.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L56)

Minimum number of non-stream indirect objects before object streams
are used.  When the count exceeds this threshold, objects are packed
into compressed object streams and a cross-reference stream replaces
the traditional xref table.

Set to `Infinity` to disable object streams (traditional xref).
A useful value for size reduction is `100`.

Default: `Infinity` (disabled for backward compatibility).

***

### updateFieldAppearances?

> `optional` **updateFieldAppearances**: `boolean`

Defined in: [src/core/pdfWriter.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L60)

Regenerate form field appearances before saving. Default: `true`.

***

### useWasm?

> `optional` **useWasm**: `boolean`

Defined in: [src/core/pdfWriter.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfWriter.ts#L44)

When `true`, attempt to use WASM-accelerated compression if the
WASM module has been initialized.  Default: `false`.
