---
layout: page
title: Playground
---

# Playground

Write code on the left, see the PDF on the right. Press **Ctrl+Enter** or click
**Run** to render. Start from one of the built-in examples — *Hello*, *Invoice*,
or *Shapes* — and edit from there.

Your snippet runs as the body of an `async` function, so top-level `await` works.
The whole library is handed to you as `pdf`, so destructure what you need and
return the bytes:

```js
const { createPdf, PageSizes, rgb } = pdf;

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);
page.drawText('Hello from the playground', { x: 50, y: 760, size: 24, color: rgb(0.1, 0.1, 0.1) });

return await doc.save(); // Uint8Array → rendered in the preview pane
```

::: warning Runs against the published release
The playground imports `modern-pdf-lib` from the
[esm.sh](https://esm.sh/modern-pdf-lib) CDN, which serves the **latest release
published to npm** — not this repository's working tree. An API added since the
last release will not exist here yet. Everything runs client-side in your
browser; nothing is uploaded.
:::

<ClientOnly>
  <PdfPlayground />
</ClientOnly>
