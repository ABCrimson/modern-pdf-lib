---
title: Browser Integration
---

# Browser Integration Guide

modern-pdf-lib runs natively in all modern browsers with zero configuration. This guide covers integration patterns for popular frameworks and vanilla JavaScript.

## Installation

### Package Manager

```bash
npm install modern-pdf-lib
```

### CDN (No Build Step)

```html
<script type="module">
  import { createPdf, PageSizes, rgb } from 'https://esm.sh/modern-pdf-lib';

  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);
  page.drawText('Hello from the browser!', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
  const bytes = await doc.save();
</script>
```

### Script Tag (IIFE)

```html
<script src="https://cdn.jsdelivr.net/npm/modern-pdf-lib/dist/modern-pdf-lib.iife.js"></script>
<script>
  const { createPdf, PageSizes, rgb } = ModernPdf;
</script>
```

## Quick Start

```typescript
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
import { saveAsDownload } from 'modern-pdf-lib/browser';

async function generatePdf() {
  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);

  page.drawText('Invoice #1234', { x: 50, y: 780, size: 28, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Date: 2026-03-07', { x: 50, y: 750, size: 12 });
  page.drawLine({ start: { x: 50, y: 740 }, end: { x: 545, y: 740 }, thickness: 1 });

  const bytes = await doc.save();
  saveAsDownload(bytes, 'invoice.pdf');
}
```

## Browser Utilities

The `modern-pdf-lib/browser` sub-path exports browser-specific helpers:

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
import { useState, useCallback } from 'react';
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
import { saveAsDownload, saveAsDataUrl } from 'modern-pdf-lib/browser';

export function PdfGenerator() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const doc = createPdf();
      const page = doc.addPage(PageSizes.A4);
      page.drawText('Generated in React', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
      const bytes = await doc.save();

      // Preview in iframe
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(saveAsDataUrl(bytes));
    } finally {
      setGenerating(false);
    }
  }, [previewUrl]);

  const download = useCallback(async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    page.drawText('Downloaded from React', { x: 50, y: 750, size: 24 });
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
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
import { saveAsDownload, saveAsDataUrl } from 'modern-pdf-lib/browser';

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
    page.drawText('Generated in Vue', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
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
  page.drawText('Downloaded from Vue', { x: 50, y: 750, size: 24 });
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
  import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
  import { saveAsDownload, saveAsDataUrl } from 'modern-pdf-lib/browser';
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
      page.drawText('Generated in Svelte', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
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
    page.drawText('Downloaded from Svelte', { x: 50, y: 750, size: 24 });
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
    import { createPdf, PageSizes, rgb } from 'https://esm.sh/modern-pdf-lib';

    document.getElementById('generate').addEventListener('click', async () => {
      const doc = createPdf();
      const page = doc.addPage(PageSizes.A4);
      page.drawText('Hello from Vanilla JS!', { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
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
      page.drawText('Downloaded!', { x: 50, y: 750, size: 24 });
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

For large PDFs, use `PdfWorker` to avoid blocking the UI:

```typescript
import { PdfWorker } from 'modern-pdf-lib/browser';

const worker = new PdfWorker();

const bytes = await worker.generate(async (pdf) => {
  const doc = pdf.createPdf();
  const page = doc.addPage(pdf.PageSizes.A4);
  page.drawText('Generated in a Web Worker!', { x: 50, y: 750, size: 24 });
  return doc.save();
});

// Use the bytes...
worker.terminate();
```

> **Note:** The task function is serialized to a string, so it cannot close over external variables. All data must come from the `pdf` argument.

## Bundle Size

Use sub-path imports to minimize bundle size:

| Import | Use Case | Includes |
|---|---|---|
| `modern-pdf-lib` | Full library | Everything |
| `modern-pdf-lib/create` | PDF creation only | Core + drawing API |
| `modern-pdf-lib/parse` | PDF parsing only | Parser + text extraction |
| `modern-pdf-lib/forms` | Form filling only | Forms + field types |
| `modern-pdf-lib/browser` | Browser features | Full library + download helpers |

## WASM Acceleration

WASM modules load automatically when available. To pre-load for faster first use:

```typescript
import { initWasm } from 'modern-pdf-lib';

// Pre-load WASM modules at app startup
await initWasm({ deflate: true, png: true, fonts: true });
```

For custom WASM paths (e.g., when self-hosting):

```typescript
import { configureWasmLoader } from 'modern-pdf-lib';

configureWasmLoader({
  basePath: '/assets/wasm/',
});
```

## Browser Compatibility

| Browser | Version | Notes |
|---|---|---|
| Chrome | 80+ | Full support |
| Firefox | 78+ | Full support |
| Safari | 14+ | Full support |
| Edge | 80+ | Full support (Chromium) |
| iOS Safari | 14+ | Full support |
| Android Chrome | 80+ | Full support |

**Required browser features:** ES2020, TextEncoder, Uint8Array, Blob, URL.createObjectURL
