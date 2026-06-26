---
title: Batch Processing
---

# Batch Processing

modern-pdf-lib provides a memory-aware batch processing engine for applying operations to many PDFs concurrently. It includes bounded concurrency, progress reporting, configurable error handling, and convenience functions for common tasks like merging and form flattening.

## Quick Start

```ts
import { processBatch } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

// Load PDF files
const dir = './invoices';
const fileNames = (await readdir(dir)).filter(f => f.endsWith('.pdf'));
const files = await Promise.all(
  fileNames.map(f => readFile(`${dir}/${f}`)),
);

// Add a watermark to every PDF
const result = await processBatch(files, async (doc) => {
  for (const page of doc.getPages()) {
    page.drawText('DRAFT', {
      x: 200, y: 400, size: 60,
      color: { type: 'rgb', r: 0.9, g: 0.9, b: 0.9 },
      rotate: { angle: 45 },
    });
  }
  return doc.save();
});

// Write outputs
for (let i = 0; i < result.outputs.length; i++) {
  if (result.outputs[i]!.length > 0) {
    await writeFile(`./output/${fileNames[i]}`, result.outputs[i]!);
  }
}

console.log(`Processed ${result.successCount} of ${files.length} files`);
```

## The `processBatch()` Function

`processBatch()` is the core entry point. It loads each `Uint8Array` as a `PdfDocument`, applies your operation, and collects the results:

```ts
async function processBatch(
  files: Uint8Array[],
  operation: (doc: PdfDocument) => Promise<Uint8Array>,
  options?: BatchOptions,
): Promise<BatchResult>
```

| Parameter | Type | Description |
|---|---|---|
| `files` | `Uint8Array[]` | Array of raw PDF bytes |
| `operation` | `(doc: PdfDocument) => Promise<Uint8Array>` | Async function that receives a loaded document and returns processed bytes |
| `options` | `BatchOptions` | Concurrency, progress, memory, error, and timeout settings |

## BatchOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `concurrency` | `number` | `4` (Node) or `files.length` (other) | Maximum simultaneous operations |
| `onProgress` | `(done, total) => void` | none | Called after each file completes |
| `maxMemoryMB` | `number` | none | Throttle concurrency when heap exceeds this limit |
| `errorStrategy` | `BatchErrorStrategy` | `'continue'` | How to handle per-item failures |
| `timeout` | `number` | none | Per-item timeout in milliseconds |

### Runtime-Aware Defaults

The default concurrency adapts to the runtime:

- **Node.js**: defaults to `4` concurrent operations (balancing CPU and memory)
- **Browsers, Deno, Bun, Cloudflare Workers**: defaults to `files.length` (all concurrent, single-threaded)

You can override this with the `concurrency` option for any runtime.

## BatchResult

```ts
interface BatchResult {
  outputs: Uint8Array[];        // Processed PDF bytes (same order as input)
  successCount: number;         // Number of successful operations
  errors: Map<number, Error>;   // Index-to-error map for failed items
}
```

Failed items produce an empty `Uint8Array(0)` in the `outputs` array. Check `result.errors` to identify which files failed and why:

```ts
const result = await processBatch(files, operation, {
  errorStrategy: 'continue',
});

if (result.errors.size > 0) {
  for (const [index, error] of result.errors) {
    console.error(`File #${index} failed: ${error.message}`);
  }
}
```

## Error Strategies

The `errorStrategy` option controls how failures are handled:

| Strategy | Behaviour |
|---|---|
| `'continue'` | Skip failed items and keep processing (default). Errors are collected in `result.errors`. |
| `'fail-fast'` | Stop on the first error and reject the promise immediately. Remaining items are cancelled. |
| `'collect'` | Process all items, then throw an `AggregateError` containing every failure. |

```ts
// Fail on first error
try {
  await processBatch(files, operation, { errorStrategy: 'fail-fast' });
} catch (err) {
  console.error('Batch aborted:', err.message);
}

// Collect all errors at the end
try {
  await processBatch(files, operation, { errorStrategy: 'collect' });
} catch (err) {
  if (err instanceof AggregateError) {
    console.error(`${err.errors.length} items failed:`);
    for (const e of err.errors) {
      console.error(` - ${e.message}`);
    }
  }
}
```

## Progress Reporting

Track batch progress with the `onProgress` callback:

```ts
const result = await processBatch(files, operation, {
  onProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    console.log(`Progress: ${done}/${total} (${pct}%)`);
  },
});
```

The callback is invoked after each item completes (success or failure), making it suitable for progress bars and status updates.

## Per-Item Timeout

Set a maximum execution time per PDF to prevent runaway operations:

```ts
const result = await processBatch(files, operation, {
  timeout: 30_000,  // 30 seconds per file
  errorStrategy: 'continue',
});
```

Items that exceed the timeout are treated as errors (with the message `Batch item #N timed out after 30000ms`) and handled according to the configured `errorStrategy`.

## Memory Management

For large batches, use `maxMemoryMB` to prevent out-of-memory crashes:

```ts
const result = await processBatch(files, operation, {
  concurrency: 8,
  maxMemoryMB: 512, // Throttle when heap exceeds 512 MB
});
```

When the heap usage exceeds the threshold:

1. Concurrency is automatically reduced to **1** (sequential processing)
2. A garbage collection hint is issued (if the runtime exposes `gc()`)
3. Once memory drops below the threshold, full concurrency is restored

::: tip
Memory monitoring uses `process.memoryUsage()` on Node.js and `performance.memory` on Chromium-based browsers. On runtimes that do not expose heap metrics, the `maxMemoryMB` option is silently ignored.
:::

## Convenience: Batch Merge

`batchMerge()` merges many PDFs into a single document using parallel chunk processing:

```ts
import { batchMerge } from 'modern-pdf-lib';

const mergedBytes = await batchMerge(pdfFiles, {
  concurrency: 4,
  onProgress(done, total) {
    console.log(`Merge chunk ${done}/${total}`);
  },
});
```

The merge strategy:

1. Input files are split into chunks (one chunk per concurrency slot)
2. Each chunk is parsed and merged in parallel
3. The resulting chunk documents are merged into the final output

This is significantly faster than sequential merging for large collections because parsing and page-copying can overlap.

```ts
// Merge 100 invoices into a single PDF
const invoices = await Promise.all(
  invoicePaths.map(p => readFile(p)),
);
const combined = await batchMerge(invoices, { concurrency: 8 });
await writeFile('all-invoices.pdf', combined);
```

::: warning
Input order is preserved -- the first file's pages appear first in the output, followed by the second file's pages, and so on.
:::

## Convenience: Batch Flatten

`batchFlatten()` flattens interactive form fields across many PDFs, burning field values into the page content:

```ts
import { batchFlatten } from 'modern-pdf-lib';

const result = await batchFlatten(formPdfs, {
  concurrency: 4,
  errorStrategy: 'continue',
});

console.log(`Flattened ${result.successCount} forms`);
```

PDFs without forms (or where flattening fails) are saved as-is -- they are not treated as errors.

## Full Example: Watermark with Progress and Memory Guard

```ts
import { processBatch } from 'modern-pdf-lib';

const result = await processBatch(files, async (doc) => {
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    page.drawText('CONFIDENTIAL', {
      x: width / 4, y: height / 2, size: 48,
      color: { type: 'rgb', r: 1, g: 0, b: 0 },
      opacity: 0.15,
      rotate: { angle: 45 },
    });
  }
  return doc.save();
}, {
  concurrency: 4,
  maxMemoryMB: 256,
  errorStrategy: 'collect',
  timeout: 30_000,
  onProgress(done, total) {
    process.stdout.write(`\rWatermarking: ${done}/${total}`);
  },
});

console.log(`\nDone: ${result.successCount} succeeded, ${result.errors.size} failed`);
```

## Best Practices

1. **Start with low concurrency** -- begin with `concurrency: 4` and increase only if your workload is I/O-bound rather than memory-bound. Each concurrent PDF consumes heap memory proportional to its size.

2. **Always set `maxMemoryMB` for large batches** -- this prevents out-of-memory crashes when processing hundreds or thousands of files. A value of 256-512 MB works well for most server environments.

3. **Use `'continue'` for fault-tolerant pipelines** -- the default error strategy skips bad files and lets you inspect failures afterward. Use `'fail-fast'` only when every file must succeed.

4. **Set per-item timeouts for untrusted input** -- if processing user-uploaded PDFs, a timeout prevents malformed files from blocking the entire batch.

5. **Use `batchMerge()` instead of sequential merging** -- for 50+ files, parallel chunk merging can be 3-5x faster than a sequential loop.

6. **Monitor progress for long-running batches** -- the `onProgress` callback enables progress bars, logging, and cancellation checks in your application.

7. **Keep operations stateless** -- the `operation` function receives a fresh `PdfDocument` for each file. Avoid sharing mutable state between invocations to prevent race conditions.
