[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfSaveOptions

# Interface: PdfSaveOptions

Defined in: [src/core/pdfWriter.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L30)

Options that control how the PDF is written.

## Properties

### addDefaultPage?

> `optional` **addDefaultPage**: `boolean`

Defined in: [src/core/pdfWriter.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L56)

Add a blank page if the document has no pages. Default: `true`.

***

### compress?

> `optional` **compress**: `boolean`

Defined in: [src/core/pdfWriter.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L32)

Apply FlateDecode compression to streams.  Default: `true`.

***

### compressionLevel?

> `optional` **compressionLevel**: `1` \| `6` \| `3` \| `2` \| `4` \| `5` \| `7` \| `8` \| `9`

Defined in: [src/core/pdfWriter.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L37)

Compression level for FlateDecode (1–9).  Default: `6`.
Ignored when `compress` is `false`.

***

### objectStreamThreshold?

> `optional` **objectStreamThreshold**: `number`

Defined in: [src/core/pdfWriter.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L54)

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

Defined in: [src/core/pdfWriter.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L58)

Regenerate form field appearances before saving. Default: `true`.

***

### useWasm?

> `optional` **useWasm**: `boolean`

Defined in: [src/core/pdfWriter.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfWriter.ts#L42)

When `true`, attempt to use WASM-accelerated compression if the
WASM module has been initialized.  Default: `false`.
