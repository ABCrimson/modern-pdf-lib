# Streaming Output

This guide covers the different ways to save a PDF document and how to use streaming for memory-efficient PDF generation.

## Output Methods

`modern-pdf` provides three methods for saving a PDF document:

| Method | Return Type | Best For |
|---|---|---|
| `pdf.save()` | `Promise<Uint8Array>` | General use, small to medium documents |
| `pdf.saveAsStream()` | `ReadableStream<Uint8Array>` | Large documents, server responses |
| `pdf.saveAsBlob()` | `Promise<Blob>` | Browser downloads and display |

## `save()` — Full Buffer

The simplest method. The entire PDF is generated in memory and returned as a `Uint8Array`:

```ts
const bytes = await pdf.save();
```

This is the right choice when:
- The document fits comfortably in memory
- You need the complete byte array (e.g., for hashing or encryption)
- You are writing to a file in one shot

```ts
import { writeFile } from 'node:fs/promises';

const bytes = await pdf.save();
await writeFile('report.pdf', bytes);
```

## `saveAsStream()` — Streaming

Returns a standard `ReadableStream<Uint8Array>` that emits PDF chunks as they are generated. The document is never fully buffered in memory.

```ts
const stream = pdf.saveAsStream();
```

This is the right choice when:
- Generating large documents (hundreds of pages, many images)
- Serving PDFs over HTTP where you want to start sending bytes immediately
- Working in memory-constrained environments (Cloudflare Workers, edge functions)

## `saveAsBlob()` — Browser Blob

Returns a `Blob` with the MIME type `application/pdf`. This is a convenience wrapper around `save()` designed for browser use:

```ts
const blob = await pdf.saveAsBlob();
const url = URL.createObjectURL(blob);
window.open(url);
```

## Streaming to a File (Node)

Pipe the stream to a file using Node's writable stream:

```ts
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';

const pdf = createPdf();
// ... add pages and content ...

const stream = pdf.saveAsStream();
const fileStream = createWriteStream('large-report.pdf');

await stream.pipeTo(Writable.toWeb(fileStream));
console.log('Done writing PDF');
```

You can also consume the stream manually:

```ts
import { open } from 'node:fs/promises';

const stream = pdf.saveAsStream();
const file = await open('output.pdf', 'w');

const reader = stream.getReader();

try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await file.write(value);
  }
} finally {
  await file.close();
}
```

## Streaming to an HTTP Response

### Cloudflare Workers

```ts
export default {
  async fetch(): Promise<Response> {
    const pdf = createPdf();
    // ... build document ...

    return new Response(pdf.saveAsStream(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="report.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  },
};
```

### Node with `http` Module

```ts
import { createServer } from 'node:http';
import { Readable } from 'node:stream';

createServer(async (req, res) => {
  const pdf = createPdf();
  // ... build document ...

  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="report.pdf"',
    'Transfer-Encoding': 'chunked',
  });

  const stream = pdf.saveAsStream();
  const nodeStream = Readable.fromWeb(stream);
  nodeStream.pipe(res);
}).listen(3000);
```

### Node with Express/Hono/Fastify

Most Node frameworks accept a `ReadableStream` or a Node `Readable` as a response body:

```ts
// Express
app.get('/report.pdf', async (req, res) => {
  const pdf = createPdf();
  // ... build document ...

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');

  const stream = pdf.saveAsStream();
  const nodeStream = Readable.fromWeb(stream);
  nodeStream.pipe(res);
});
```

## Memory Considerations for Large Documents

### Why Streaming Matters

When generating a 500-page report with embedded images, `save()` must hold the entire PDF in memory at once. With `saveAsStream()`, pages are serialized and flushed incrementally:

| Method | Peak Memory (500 pages, 50 images) |
|---|---|
| `save()` | ~120 MB |
| `saveAsStream()` | ~15 MB |

> [!TIP]
> For documents with more than 50 pages or more than 10 MB of embedded images, prefer `saveAsStream()`.

### Memory Tips

1. **Embed images before adding pages.** Image data is compressed during embedding, not during save.
2. **Reuse font and image references.** Embedding the same image twice doubles memory usage.
3. **Use JPEG for photographs.** JPEG passthrough avoids decompression and recompression.
4. **Enable WASM.** The WASM compressor uses less memory than the pure-JS fallback.

## Backpressure Handling

The `ReadableStream` returned by `saveAsStream()` respects backpressure. If the consumer is slower than the producer (for example, a slow network connection), the stream pauses PDF generation until the consumer is ready for more data.

This is handled automatically by the Web Streams API. No special configuration is needed:

```ts
// Backpressure is handled automatically by pipeTo()
await pdf.saveAsStream().pipeTo(writableStream);
```

If you are consuming the stream manually with a reader, the backpressure is applied naturally by the `await reader.read()` call:

```ts
const reader = pdf.saveAsStream().getReader();

while (true) {
  // This await creates natural backpressure — the stream
  // pauses until we call read() again
  const { done, value } = await reader.read();
  if (done) break;

  await slowNetworkWrite(value);
}
```

### Monitoring Stream Progress

You can wrap the stream with a `TransformStream` to monitor progress:

```ts
let totalBytes = 0;

const progress = new TransformStream<Uint8Array, Uint8Array>({
  transform(chunk, controller) {
    totalBytes += chunk.byteLength;
    console.log(`Written ${(totalBytes / 1024).toFixed(1)} KB`);
    controller.enqueue(chunk);
  },
});

await pdf.saveAsStream().pipeThrough(progress).pipeTo(destination);
console.log(`Total: ${(totalBytes / 1024).toFixed(1)} KB`);
```

## Comparison Summary

```
save()           ──►  Uint8Array        Simple, entire PDF in memory
saveAsStream()   ──►  ReadableStream    Incremental, low memory
saveAsBlob()     ──►  Blob              Browser convenience
```

Choose `save()` for simplicity, `saveAsStream()` for scalability, and `saveAsBlob()` for browser downloads.
