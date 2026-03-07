<template>
  <div class="playground">
    <div class="playground-editor">
      <div class="editor-header">
        <span class="editor-title">Code</span>
        <select v-model="selectedExample" @change="loadExample" class="example-select">
          <option value="hello">Hello World</option>
          <option value="invoice">Invoice</option>
          <option value="shapes">Shapes &amp; Colors</option>
        </select>
        <button @click="run" class="run-btn" :disabled="running">
          {{ running ? 'Generating...' : 'Run' }}
        </button>
      </div>
      <textarea
        v-model="code"
        class="code-input"
        spellcheck="false"
        @keydown.ctrl.enter="run"
        @keydown.meta.enter="run"
      />
    </div>
    <div class="playground-preview">
      <div class="preview-header">
        <span class="preview-title">Preview</span>
        <span v-if="pdfSize" class="pdf-size">{{ pdfSize }}</span>
      </div>
      <iframe
        v-if="pdfUrl"
        :src="pdfUrl"
        class="pdf-frame"
      />
      <div v-else-if="error" class="error-msg">{{ error }}</div>
      <div v-else class="placeholder">Press Ctrl+Enter or click Run to generate PDF</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

const EXAMPLES: Record<string, string> = {
  hello: `const { createPdf, PageSizes, rgb } = pdf;

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawText('Hello from the Playground!', {
  x: 50,
  y: 750,
  size: 28,
  color: rgb(0.13, 0.13, 0.13),
});

page.drawText('Edit the code on the left and press Ctrl+Enter.', {
  x: 50,
  y: 700,
  size: 14,
  color: rgb(0.4, 0.4, 0.4),
});

return await doc.save();`,

  invoice: `const { createPdf, PageSizes, rgb, grayscale } = pdf;

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

// Header
page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: rgb(0.1, 0.1, 0.2) });
page.drawText('INVOICE', { x: 50, y: 800, size: 24, color: rgb(1, 1, 1) });
page.drawText('#INV-2026-001', { x: 400, y: 800, size: 14, color: rgb(0.7, 0.7, 0.8) });

// Details
page.drawText('Bill To: Acme Corp', { x: 50, y: 740, size: 12 });
page.drawText('Date: 2026-03-07', { x: 400, y: 740, size: 12 });

// Line items header
const y = 680;
page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 20, color: rgb(0.95, 0.95, 0.95) });
page.drawText('Item', { x: 55, y, size: 10 });
page.drawText('Qty', { x: 350, y, size: 10 });
page.drawText('Price', { x: 400, y, size: 10 });
page.drawText('Total', { x: 470, y, size: 10 });

// Items
const items = [['PDF Library License', '1', '$499', '$499'], ['Support Plan', '1', '$199', '$199']];
items.forEach(([item, qty, price, total], i) => {
  const iy = y - 25 - i * 20;
  page.drawText(item, { x: 55, y: iy, size: 10 });
  page.drawText(qty, { x: 355, y: iy, size: 10 });
  page.drawText(price, { x: 400, y: iy, size: 10 });
  page.drawText(total, { x: 470, y: iy, size: 10 });
});

// Total
page.drawLine({ start: { x: 400, y: y - 70 }, end: { x: 545, y: y - 70 }, thickness: 1 });
page.drawText('Total: $698', { x: 450, y: y - 90, size: 14 });

return await doc.save();`,

  shapes: `const { createPdf, PageSizes, rgb, cmyk, grayscale } = pdf;

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

// Colorful rectangles
const colors = [rgb(0.95, 0.26, 0.21), rgb(0.13, 0.59, 0.95), rgb(0.30, 0.69, 0.31), rgb(1, 0.76, 0.03)];
colors.forEach((color, i) => {
  page.drawRectangle({ x: 50 + i * 130, y: 700, width: 110, height: 80, color, borderColor: grayscale(0), borderWidth: 1 });
});

// Circles
for (let i = 0; i < 5; i++) {
  page.drawCircle({
    x: 120 + i * 90,
    y: 580,
    radius: 35,
    color: rgb(Math.random(), Math.random(), Math.random()),
    opacity: 0.7,
  });
}

// Lines
for (let i = 0; i < 10; i++) {
  page.drawLine({
    start: { x: 50, y: 450 - i * 15 },
    end: { x: 545, y: 450 - i * 15 },
    color: rgb(i / 10, 0.5, 1 - i / 10),
    thickness: 2,
  });
}

page.drawText('Shapes & Colors', { x: 50, y: 250, size: 32, color: rgb(0.1, 0.1, 0.1) });

return await doc.save();`,
};

const code = ref(EXAMPLES.hello);
const selectedExample = ref('hello');
const pdfUrl = ref('');
const pdfSize = ref('');
const error = ref('');
const running = ref(false);

function loadExample() {
  code.value = EXAMPLES[selectedExample.value] || EXAMPLES.hello;
  pdfUrl.value = '';
  pdfSize.value = '';
  error.value = '';
}

async function run() {
  if (running.value) return;
  running.value = true;
  error.value = '';

  try {
    const pdf = await import('modern-pdf-lib');
    const fn = new Function('pdf', `return (async () => { ${code.value} })()`);
    const bytes = await fn(pdf);

    if (!(bytes instanceof Uint8Array)) {
      throw new Error('Code must return a Uint8Array (use "return await doc.save()")');
    }

    if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    pdfUrl.value = URL.createObjectURL(blob);
    pdfSize.value = formatBytes(bytes.length);
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    running.value = false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

onUnmounted(() => {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
});
</script>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 600px;
  margin-top: 24px;
}

.playground-editor,
.playground-preview {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-header,
.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
  font-weight: 600;
}

.editor-title,
.preview-title {
  flex: 1;
}

.pdf-size {
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-weight: normal;
}

.example-select {
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 12px;
}

.run-btn {
  padding: 4px 16px;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.run-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}

.run-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.code-input {
  flex: 1;
  padding: 12px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  border: none;
  resize: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  tab-size: 2;
}

.code-input:focus {
  outline: none;
}

.pdf-frame {
  flex: 1;
  border: none;
  background: white;
}

.error-msg {
  flex: 1;
  padding: 16px;
  color: var(--vp-c-danger-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-3);
  font-size: 14px;
}

@media (max-width: 768px) {
  .playground {
    grid-template-columns: 1fr;
  }
}
</style>
