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

#### Intrinsic elements

| Tag | Props | Meaning |
|---|---|---|
| `document` | `{ size? }` | Root container. `size` is the default page size. |
| `page` | `{ size? }` | Starts a new PDF page (overrides the document size). |
| `text` | `{ x?, y?, size?, color?, bold? }` | Draws one text line. |
| `view` | `{ x?, y?, width?, height?, padding?, background? }` | A block container; indents and pads its children. |
| `rect` | `{ x, y, width, height, color?, border? }` | Draws a rectangle. |

Function components are plain `(props) => PdfNode` functions — they receive
their props (children as `props.children`) and their return value is rendered in
place. `Fragment` groups children without adding a layout box. Standard-14
Helvetica and Helvetica-Bold are embedded automatically.

::: details How the layout cursor works
Layout is a deterministic **top-down block flow**, one cursor per page:

- Each `page` starts a y cursor at `pageHeight - MARGIN_TOP` and an x cursor at
  `MARGIN_LEFT`. PDF space is y-up but documents read top-down, so the y cursor
  *decreases* as blocks are placed.
- A flowed `text` draws at `(x, y - ascent)` and advances y down by its line
  height (`size × LINE_HEIGHT_FACTOR`).
- A flowed `view` optionally paints its `background`, indents x by `padding`,
  flows its children, then restores x and advances y past the consumed block
  plus padding.
- **Absolute positioning:** an element that supplies both `x` *and* `y` is
  placed at exactly that PDF coordinate and neither consumes nor advances the
  flow cursor. `rect` requires explicit `x`/`y`, so it is always absolute.
- Each `page` element resets both cursors and starts a fresh PDF page.
:::

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

#### Schema → field mapping

| JSON Schema | Field kind |
|---|---|
| `type: 'string'` | text field |
| `type: 'string'` **+** `enum: [...]` | dropdown (combo box) |
| `type: 'boolean'` | checkbox |
| `type: 'number'` / `type: 'integer'` | text field |
| `type: 'object'` / `type: 'array'` / unknown | text field (placeholder) |

Only `type`, `properties`, `required`, and `enum` are read; other keywords are
ignored. `enum` is honoured for `type: 'string'` only. Required properties get an
asterisk in their label. Fields stack top-down and paginate automatically.

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

#### Which adapter to use

| Function | Returns | Use it for |
|---|---|---|
| `pdfResponse(bytes, options?)` | `Response` | Any Web-standard server: Workers, Deno, Bun, Hono, Next route handlers |
| `pdfStreamResponse(stream, options?)` | `Response` | Streaming a `ReadableStream`; pass `byteLength` if you know it, otherwise `Content-Length` is omitted and the body is chunked |
| `sendPdfToNodeResponse(res, bytes, options?)` | `void` | Classic Node `http` / Express — writes head and ends the response |
| `pdfHeaders(byteLength, options?)` | `Record<string, string>` | Building the response yourself |

#### `PdfResponseOptions`

| Option | Type | Effect |
|---|---|---|
| `filename` | `string` | Populates `Content-Disposition`; non-ASCII is handled automatically |
| `download` | `boolean` | `true` → `attachment` (downloads); omitted or `false` → `inline` (viewer) |
| `status` | `number` | HTTP status code. Default `200` |
| `cacheControl` | `string` | Value for `Cache-Control` |
| `lastModified` | `Date` | Serialised to the HTTP-date format for `Last-Modified` |
| `headers` | `Record<string, string>` | Extra headers, merged **first** — the core PDF headers always win |

Non-ASCII filenames are encoded with the RFC 5987 `filename*` form (with an ASCII
fallback), so `résumé.pdf` downloads correctly everywhere.
