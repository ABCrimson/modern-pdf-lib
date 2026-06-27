# Framework Integration & Developer Experience

modern-pdf-lib ships ergonomic, framework-agnostic ways to generate PDFs: a JSX
component renderer, JSON-Schema-driven form generation, and server adapters that
turn PDF bytes into a Web-standard `Response`.

## JSX / component rendering

Describe a document as a tree of components and render it to a PDF. The element
model is intentionally simple (top-down block flow with an absolute-positioning
escape hatch) — not a full flexbox engine.

### Hyperscript (`jsxh`)

```ts
import { jsxh, renderJsxToPdf, PageSizes } from 'modern-pdf-lib';

const pdf = await renderJsxToPdf(
  jsxh('document', { size: PageSizes.A4 },
    jsxh('page', null,
      jsxh('text', { size: 24, bold: true }, 'Invoice'),
      jsxh('text', null, 'Thank you for your business.'),
      jsxh('view', { padding: 12, background: [0.95, 0.95, 0.95] },
        jsxh('text', null, 'Total: $1,234.56'),
      ),
    ),
  ),
); // → Uint8Array, a valid %PDF-
```

Intrinsic elements: `document` (root, `{ size }`), `page` (`{ size }`), `text`
(`{ x?, y?, size?, color?, bold? }`), `view` (block container,
`{ x?, y?, width?, height?, padding?, background? }`), and `rect`
(`{ x, y, width, height, color?, border? }`). Function components receive their
props and render their return value; `Fragment` groups children. Standard-14
Helvetica/Helvetica-Bold are embedded automatically.

### JSX syntax (automatic runtime)

For real JSX syntax, point your transform's automatic runtime at the package's
`jsx`/`jsxs`/`Fragment` exports and render the result with `renderJsxToPdf`:

```tsx
/** @jsxRuntime automatic */
import { renderJsxToPdf } from 'modern-pdf-lib';

function Report({ title }: { title: string }) {
  return (
    <document>
      <page>
        <text size={24} bold>{title}</text>
        <text>Generated with modern-pdf-lib.</text>
      </page>
    </document>
  );
}

const pdf = await renderJsxToPdf(<Report title="Q3 Summary" />);
```

::: warning Layout scope
The renderer does simple block flow + absolute positioning. It does **not** do
text wrapping/reflow, automatic cross-page overflow, percentage sizing, or
z-index. Use explicit `x`/`y` for precise placement, and start a new `<page>`
when content would overflow.
:::

## Generating forms from a JSON Schema

`buildFormFromJsonSchema` turns a JSON Schema object into a fillable AcroForm —
one labelled field per property.

```ts
import { buildFormFromJsonSchema } from 'modern-pdf-lib';

const { doc, fields } = buildFormFromJsonSchema(
  {
    type: 'object',
    properties: {
      fullName: { type: 'string', title: 'Full name' },
      country: { type: 'string', enum: ['US', 'CA', 'MX'] },
      subscribe: { type: 'boolean', title: 'Subscribe to updates' },
    },
    required: ['fullName'],
  },
  { title: 'Sign-up' },
);

const bytes = await doc.save();
// fields → [{ name: 'fullName', kind: 'text' }, { name: 'country', kind: 'dropdown' }, …]
```

Mapping: `string` → text field, `string` + `enum` → dropdown, `boolean` →
checkbox, `number`/`integer` → text field. Required properties get an asterisk in
the label. Fields stack top-down and paginate automatically. Nested
`object`/`array` (and unknown keywords) degrade to a text placeholder — documented
in the API.

## Serving PDFs from a server

`pdfResponse` wraps PDF bytes in a Web-standard `Response` (Workers, Deno, Bun,
Node ≥18) with the correct `Content-Type`, `Content-Length`, and RFC 6266
`Content-Disposition`:

```ts
import { pdfResponse, pdfStreamResponse, sendPdfToNodeResponse } from 'modern-pdf-lib';

// Web standard (Hono, Workers, Deno, Bun, Next route handlers):
export function GET() {
  return pdfResponse(bytes, { filename: 'report.pdf', download: true });
}

// Streaming (unknown length):
return pdfStreamResponse(readableStream);

// Classic Node http / Express:
app.get('/report.pdf', (req, res) => {
  sendPdfToNodeResponse(res, bytes, { filename: 'report.pdf' });
});
```

Non-ASCII filenames are encoded with the RFC 5987 `filename*` form (with an ASCII
fallback), so `résumé.pdf` downloads correctly everywhere. `pdfHeaders(byteLength,
options)` is exposed if you want to set the headers yourself.
