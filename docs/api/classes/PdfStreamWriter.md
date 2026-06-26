[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStreamWriter

# Class: PdfStreamWriter

Defined in: [src/core/pdfStream.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfStream.ts#L67)

A PDF writer that produces a `ReadableStream<Uint8Array>`.

Usage:
```ts
const streamWriter = new PdfStreamWriter(registry, structure, options);
const readable = streamWriter.toReadableStream();
// Pipe or consume the readable stream
```

The stream handles back-pressure automatically via the underlying
`TransformStream`.

## Constructors

### Constructor

```ts
new PdfStreamWriter(
   registry, 
   structure, 
   options?): PdfStreamWriter;
```

Defined in: [src/core/pdfStream.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfStream.ts#L72)

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

`PdfStreamWriter`

## Methods

### toReadableStream()

```ts
toReadableStream(): ReadableStream<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/pdfStream.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfStream.ts#L94)

Create a `ReadableStream<Uint8Array>` that emits the complete PDF.

The stream respects back-pressure: it will not produce data faster
than the consumer can handle.

#### Returns

`ReadableStream`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;
