---
title: Browser Integration
---

# Browser Integration Guide

modern-pdf-lib runs in current browsers without a build step or WebAssembly setup; [Browser Compatibility](#browser-compatibility) lists the minimum versions. This guide covers integration patterns for popular frameworks and vanilla JavaScript.

## Installation

### Package Manager

```bash
npm install modern-pdf-lib
# or: pnpm add modern-pdf-lib | yarn add modern-pdf-lib | bun add modern-pdf-lib
```

### CDN (No Build Step)

```html
<script type="module">
  import { createPdf, PageSizes, StandardFonts, rgb } from 'https://esm.sh/modern-pdf-lib@<version>';

  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Hello from the browser!', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
  const bytes = await doc.save();
</script>
```

Replace `<version>` with an exact released version. Without a version, esm.sh and jsDelivr resolve to the latest release.

### Script Tag (IIFE)

```html
<script
  src="https://cdn.jsdelivr.net/npm/modern-pdf-lib@<version>/dist/modern-pdf-lib.iife.js"
  integrity="sha384-<hash of the pinned file>"
  crossorigin="anonymous"
></script>
<script>
  const { createPdf, PageSizes, rgb } = ModernPdf;
</script>
```

The IIFE bundle (`dist/modern-pdf-lib.iife.js`, global `ModernPdf`) ships from 0.40.4; earlier published versions do not contain it. Pin a version in production and set `integrity` to the hash of the pinned file. The `unpkg` and `jsdelivr` fields in `package.json` point at `dist/browser.mjs`, an ES module, so a bare package URL does not work as a classic `<script src>`; use the explicit file path above.

## Quick Start

```typescript
import { createPdf, PageSizes, StandardFonts, rgb, saveAsDownload } from 'modern-pdf-lib/browser';

async function generatePdf() {
  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('Invoice #1234', { x: 50, y: 780, size: 28, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Date: 2026-03-07', { x: 50, y: 750, size: 12, font });
  page.drawLine({ start: { x: 50, y: 740 }, end: { x: 545, y: 740 }, thickness: 1 });

  const bytes = await doc.save();
  saveAsDownload(bytes, 'invoice.pdf');
}
```

## Browser Utilities

The `modern-pdf-lib/browser` sub-path re-exports the whole main entry and adds browser-specific helpers, so browser code can import everything from it:

| Function | Description |
|---|---|
| `saveAsDownload(bytes, filename?)` | Trigger a file download |
| `saveAsBlob(bytes)` | Convert to Blob (for uploads, FormData) |
| `saveAsDataUrl(bytes)` | Create blob: URL (for iframe preview) |
| `openInNewTab(bytes)` | Open PDF in a new browser tab |
| `PdfWorker` | Off-main-thread PDF generation |

## Framework Examples

### React

```tsx
import { useState, useCallback, useEffect } from 'react';
import { createPdf, PageSizes, StandardFonts, rgb, saveAsDownload, saveAsDataUrl } from 'modern-pdf-lib/browser';

export function PdfGenerator() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const doc = createPdf();
      const page = doc.addPage(PageSizes.A4);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Generated in React', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
      const bytes = await doc.save();

      // Preview in iframe (the effect above revokes the previous URL)
      setPreviewUrl(saveAsDataUrl(bytes));
    } finally {
      setGenerating(false);
    }
  }, []);

  const download = useCallback(async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Downloaded from React', { x: 50, y: 750, size: 24, font });
    const bytes = await doc.save();
    saveAsDownload(bytes, 'react-demo.pdf');
  }, []);

  return (
    <div>
      <button onClick={generate} disabled={generating}>
        {generating ? 'Generating...' : 'Preview PDF'}
      </button>
      <button onClick={download}>Download PDF</button>
      {previewUrl && (
        <iframe src={previewUrl} style={{ width: '100%', height: 600, border: '1px solid #ddd' }} />
      )}
    </div>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { createPdf, PageSizes, StandardFonts, rgb, saveAsDownload, saveAsDataUrl } from 'modern-pdf-lib/browser';

const previewUrl = ref<string | null>(null);
const generating = ref(false);

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

async function generate() {
  generating.value = true;
  try {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Generated in Vue', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
    const bytes = await doc.save();

    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = saveAsDataUrl(bytes);
  } finally {
    generating.value = false;
  }
}

async function download() {
  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Downloaded from Vue', { x: 50, y: 750, size: 24, font });
  const bytes = await doc.save();
  saveAsDownload(bytes, 'vue-demo.pdf');
}
</script>

<template>
  <div>
    <button @click="generate" :disabled="generating">
      {{ generating ? 'Generating...' : 'Preview PDF' }}
    </button>
    <button @click="download">Download PDF</button>
    <iframe v-if="previewUrl" :src="previewUrl" style="width: 100%; height: 600px; border: 1px solid #ddd" />
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
  import { createPdf, PageSizes, StandardFonts, rgb, saveAsDownload, saveAsDataUrl } from 'modern-pdf-lib/browser';
  import { onDestroy } from 'svelte';

  let previewUrl: string | null = $state(null);
  let generating = $state(false);

  onDestroy(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  async function generate() {
    generating = true;
    try {
      const doc = createPdf();
      const page = doc.addPage(PageSizes.A4);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Generated in Svelte', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
      const bytes = await doc.save();

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = saveAsDataUrl(bytes);
    } finally {
      generating = false;
    }
  }

  async function download() {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Downloaded from Svelte', { x: 50, y: 750, size: 24, font });
    const bytes = await doc.save();
    saveAsDownload(bytes, 'svelte-demo.pdf');
  }
</script>

<div>
  <button onclick={generate} disabled={generating}>
    {generating ? 'Generating...' : 'Preview PDF'}
  </button>
  <button onclick={download}>Download PDF</button>
  {#if previewUrl}
    <iframe src={previewUrl} style="width: 100%; height: 600px; border: 1px solid #ddd"></iframe>
  {/if}
</div>
```

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>PDF Generator</title>
</head>
<body>
  <button id="generate">Generate PDF</button>
  <button id="download">Download PDF</button>
  <iframe id="preview" style="width: 100%; height: 600px; border: 1px solid #ddd; display: none;"></iframe>

  <script type="module">
    import { createPdf, PageSizes, StandardFonts, rgb } from 'https://esm.sh/modern-pdf-lib@<version>';

    document.getElementById('generate').addEventListener('click', async () => {
      const doc = createPdf();
      const page = doc.addPage(PageSizes.A4);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Hello from Vanilla JS!', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
      const bytes = await doc.save();

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const iframe = document.getElementById('preview');
      iframe.src = url;
      iframe.style.display = 'block';
    });

    document.getElementById('download').addEventListener('click', async () => {
      const doc = createPdf();
      const page = doc.addPage(PageSizes.A4);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Downloaded!', { x: 50, y: 750, size: 24, font });
      const bytes = await doc.save();

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>
```

## Web Workers

For large PDFs, use `PdfWorker` to avoid blocking the UI. Always pass `workerUrl`: without it, `PdfWorker` builds an inline worker from a `Blob` whose source starts with `import * as pdf from 'modern-pdf-lib'`, a bare specifier, which a blob-URL module worker cannot resolve without an import map.

The worker script is a module that your bundler builds as a separate worker entry, so it can import `modern-pdf-lib`. It receives `{ id, taskCode }` messages and answers with `{ id, result }` or `{ id, error }`:

```typescript
// pdf-worker.ts
import * as pdf from 'modern-pdf-lib/browser';

self.onmessage = async (e: MessageEvent<{ id: number; taskCode: string }>) => {
  const { id, taskCode } = e.data;
  try {
    const taskFn = new Function('return ' + taskCode)();
    const result = await taskFn(pdf);
    if (result instanceof Uint8Array) {
      self.postMessage({ id, result }, { transfer: [result.buffer as ArrayBuffer] });
    } else {
      self.postMessage({ id, error: 'Task must return a Uint8Array' });
    }
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
```

```typescript
import { PdfWorker } from 'modern-pdf-lib/browser';
// Vite: `?worker&url` bundles pdf-worker.ts as a worker and returns the built file's URL
import pdfWorkerUrl from './pdf-worker.ts?worker&url';

const worker = new PdfWorker({ workerUrl: pdfWorkerUrl });

const bytes = await worker.generate(async (pdf) => {
  const doc = pdf.createPdf();
  const page = doc.addPage(pdf.PageSizes.A4);
  const font = await doc.embedFont(pdf.StandardFonts.Helvetica);
  page.drawText('Generated in a Web Worker!', { x: 50, y: 750, size: 24, font });
  return doc.save();
});

// Use the bytes...
worker.terminate();
```

With other bundlers, build `pdf-worker.ts` as its own entry and pass the URL of the built file. In Vite, a plain `new URL('./pdf-worker.ts', import.meta.url)` is copied as a static asset, not bundled.

> **Note:** The task function is serialized to a string, so it cannot close over external variables. All data must come from the `pdf` argument. The worker evaluates the serialized task with `new Function`, so its Content Security Policy must allow `'unsafe-eval'`; see [Content Security Policy](./csp.md).

## Bundle Size

Use sub-path imports to minimize bundle size:

| Import | Use Case | Includes |
|---|---|---|
| `modern-pdf-lib` | Full library | Everything |
| `modern-pdf-lib/create` | PDF creation only | Core + drawing API |
| `modern-pdf-lib/parse` | PDF parsing only | Parser + text extraction |
| `modern-pdf-lib/forms` | Form filling only | Forms + field types |
| `modern-pdf-lib/browser` | Browser features | Full library + download helpers |

## WebAssembly

The package ships WebAssembly builds of six Rust crates under `dist/wasm/`, but this release's JavaScript does not run them; all work runs in pure JavaScript, so no WebAssembly setup is needed in the browser. `initWasm()` is not required.

## Browser Compatibility

The code calls `Uint8Array.prototype.toBase64()`, `toHex()`, `Uint8Array.fromBase64()` and `fromHex()` without a fallback, along with `Promise.withResolvers`, `Set.prototype.union` and the iterator helpers (`.map`, `.toArray`); the newest are the `Uint8Array` methods (Chrome, Firefox) and the iterator helpers (Safari 18.4). Minimums from MDN browser-compat-data (read 2026-11-15):

| Browser | Minimum version |
|---|---|
| Chrome | 140 |
| Edge | 140 (Chromium) |
| Firefox | 133 |
| Safari | 18.4 |
| iOS Safari | 18.4 |
| Android Chrome | 140 |

**Required browser features:** ES2022 (the IIFE bundle's build target), `Promise.withResolvers`, `Set.prototype.union`, `Uint8Array` base64 and hex methods, iterator helpers (`Iterator.from`, `.map`, `.toArray`), TextEncoder, Blob, URL.createObjectURL

CI runs the Playwright end-to-end suite on Chromium, Firefox and WebKit.
