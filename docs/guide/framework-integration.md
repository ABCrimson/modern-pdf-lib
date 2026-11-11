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
import { jsxh, renderJsxToPdf, PageSizes, rgb } from 'modern-pdf-lib';

const pdf = await renderJsxToPdf(
  jsxh('document', { size: PageSizes.A4 },
    jsxh('page', null,
      jsxh('text', { size: 24, bold: true }, 'Invoice'),
      jsxh('text', null, 'Thank you for your business.'),
      jsxh('view', { x: 50, y: 600, width: 200, height: 40, padding: 12, background: rgb(0.95, 0.95, 0.95) },
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

`color`, `background` and `border` take `Color` values such as `rgb(0.95, 0.95, 0.95)`, not arrays of numbers.

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
- A flowed `view` indents x by `padding`, flows its children, then restores x
  and advances y past the consumed block plus padding. If it has a `background`,
  the fill is drawn after the children and covers them; an absolute `view` with
  `x`, `y`, `width` and `height` draws its `background` first.
- **Absolute positioning:** an element that supplies both `x` *and* `y` is
  placed at exactly that PDF coordinate and neither consumes nor advances the
  flow cursor. `rect` requires explicit `x`/`y`, so it is always absolute.
- Each `page` element resets both cursors and starts a fresh PDF page.
:::

### Automatic-runtime factories (`jsx`, `jsxs`)

The package exports the automatic-runtime functions `jsx`, `jsxs` and `Fragment`, but it has no `jsx-runtime` entry point and declares no JSX element types. `jsxImportSource: "modern-pdf-lib"` therefore does not resolve, and JSX tags such as `<document>` do not type-check. Call the factories directly, with children under `props.children`, and render the result with `renderJsxToPdf`:

```ts
import { jsx, jsxs, renderJsxToPdf } from 'modern-pdf-lib';

function Report(props: Record<string, unknown>) {
  return jsx('document', {
    children: jsxs('page', {
      children: [
        jsx('text', { size: 24, bold: true, children: String(props['title']) }),
        jsx('text', { children: 'Generated with modern-pdf-lib.' }),
      ],
    }),
  });
}

const pdf = await renderJsxToPdf(jsx(Report, { title: 'Q3 Summary' }));
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

Only `type`, `properties`, `required`, `enum`, and `title` (used as the field
label) are read; other keywords, including validation keywords such as
`minLength` or `pattern`, are ignored, and sub-properties of a nested object are
not expanded. `enum` is honoured for `type: 'string'` only. Required properties get an
asterisk in their label. Fields stack top-down and paginate automatically.

## Serving PDFs from a server

`pdfResponse` wraps PDF bytes in a Web-standard `Response` with the correct `Content-Type`, `Content-Length`, and RFC 6266
`Content-Disposition`. The package requires Node >=26.4 (`engines` in
`package.json`); Deno, Bun and Cloudflare Workers are not tested in CI.

```ts
import { pdfResponse, pdfStreamResponse, sendPdfToNodeResponse } from 'modern-pdf-lib';

// Web standard (Hono, Workers, Deno, Bun, Next route handlers):
export async function GET() {
  const bytes = await buildReport(); // your function returning doc.save()
  return pdfResponse(bytes, { filename: 'report.pdf', download: true });
}

// Streaming (unknown length):
function streamReport(): Response {
  const readableStream = buildReportStream(); // a ReadableStream<Uint8Array>
  return pdfStreamResponse(readableStream);
}

// Classic Node http / Express:
app.get('/report.pdf', async (req, res) => { // app: your Express app
  const bytes = await buildReport();
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

Non-ASCII filenames are encoded with the RFC 8187 `filename*` form (with an ASCII
fallback), so `résumé.pdf` downloads correctly everywhere.
