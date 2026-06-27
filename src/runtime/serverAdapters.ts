/**
 * @module runtime/serverAdapters
 *
 * Web-standard and Node-flavoured helpers for serving a generated PDF
 * from an HTTP server.
 *
 * The goal is to make "I have a `Uint8Array` of PDF bytes — now send it
 * to the client" a one-liner in any runtime:
 *
 * ```ts
 * // Cloudflare Workers / Deno / Bun / Node >=18 (Web `Response`):
 * import { pdfResponse } from 'modern-pdf-lib';
 * return pdfResponse(await doc.save(), { filename: 'report.pdf', download: true });
 *
 * // Express / node:http (no Web `Response`):
 * import { sendPdfToNodeResponse } from 'modern-pdf-lib';
 * sendPdfToNodeResponse(res, await doc.save(), { filename: 'report.pdf' });
 * ```
 *
 * Header construction follows **RFC 6266** ("Use of the Content-Disposition
 * Header Field in HTTP") and its referenced **RFC 5987** extended parameter
 * encoding:
 *
 *  - `Content-Disposition` uses the `disposition-type` of either `inline`
 *    (view in browser) or `attachment` (force download).
 *  - The plain `filename` parameter carries an ASCII-only fallback whose
 *    value is a `quoted-string` (so `"` and `\` are backslash-escaped),
 *    per RFC 6266 §4.1 / RFC 2616 quoted-string rules.
 *  - When the filename contains non-ASCII characters, an additional
 *    `filename*` parameter is emitted using the RFC 5987 `ext-value`
 *    grammar: `UTF-8''<percent-encoded-bytes>`.  This is the form
 *    recommended by RFC 6266 Appendix D for internationalised filenames,
 *    with the bare `filename` retained as a fallback for legacy agents.
 *
 * @see https://www.rfc-editor.org/rfc/rfc6266 — Content-Disposition in HTTP
 * @see https://www.rfc-editor.org/rfc/rfc5987 — Character set / language
 *      encoding for HTTP header field parameters (the `filename*` form)
 *
 * No Node-only modules are imported: `Response` / `ReadableStream` are
 * feature-detected, and the Node response object is consumed through a
 * minimal structural interface ({@link NodeServerResponseLike}).
 */

// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

/**
 * Options shared by every PDF-serving helper in this module.
 *
 * All fields are optional.  `exactOptionalPropertyTypes` is enabled in
 * this project, so each property is declared as `T | undefined` to allow
 * callers to pass an explicit `undefined`.
 */
export interface PdfResponseOptions {
  /**
   * Suggested filename for the document.  Used to populate the
   * `Content-Disposition` header.  May contain non-ASCII characters —
   * an RFC 6266 `filename*` form is emitted automatically when needed.
   */
  filename?: string | undefined;
  /**
   * When `true`, the `Content-Disposition` type is `attachment`
   * (the browser downloads the file).  When `false` or omitted it is
   * `inline` (the browser displays the PDF in a viewer).
   */
  download?: boolean | undefined;
  /** Value for the `Cache-Control` response header, if any. */
  cacheControl?: string | undefined;
  /** HTTP status code (default `200`). */
  status?: number | undefined;
  /**
   * Additional response headers.  These are merged *first*, so the
   * core PDF headers (Content-Type / Content-Length / Content-Disposition)
   * always take precedence over any same-named custom header.
   */
  headers?: Record<string, string> | undefined;
  /**
   * Value for the `Last-Modified` response header.  Serialised with
   * {@link Date.toUTCString} (the HTTP-date format).
   */
  lastModified?: Date | undefined;
}

// ---------------------------------------------------------------------------
// Content-Disposition construction (RFC 6266 + RFC 5987)
// ---------------------------------------------------------------------------

/**
 * Characters that are safe to leave unencoded inside the RFC 5987
 * `attr-char` production used by `filename*`.  Everything else is
 * percent-encoded from its UTF-8 bytes.
 *
 * `attr-char = ALPHA / DIGIT / "!" / "#" / "$" / "&" / "+" / "-" /
 *              "." / "^" / "_" / "`" / "|" / "~"`  (RFC 5987 §3.2.1)
 */
const RFC5987_ATTR_CHAR = /[A-Za-z0-9!#$&+\-.^_`|~]/;

/** Reusable UTF-8 encoder for the `filename*` byte serialisation. */
const utf8Encoder = new TextEncoder();

/**
 * Percent-encode a string as an RFC 5987 `value-chars` sequence: every
 * byte that is not an `attr-char` is written as `%HH` (upper-case hex)
 * from its UTF-8 representation.
 *
 * @param value  The raw (possibly non-ASCII) string.
 * @returns      The `value-chars` portion of an `ext-value`.
 */
function encodeRfc5987(value: string): string {
  const bytes = utf8Encoder.encode(value);
  let out = '';
  for (const byte of bytes) {
    const char = String.fromCharCode(byte);
    if (byte < 0x80 && RFC5987_ATTR_CHAR.test(char)) {
      out += char;
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}

/**
 * A small transliteration table mapping common accented Latin letters to
 * their closest ASCII equivalent.  Used only for the *fallback* `filename`
 * parameter — the authoritative value is always carried by `filename*`.
 *
 * This is intentionally minimal: it covers the Latin-1 / Latin Extended-A
 * letters most likely to appear in document names so that legacy clients
 * (which ignore `filename*`) still receive a readable name.
 */
const TRANSLITERATIONS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', ā: 'a', ă: 'a', ą: 'a',
    ç: 'c', ć: 'c', č: 'c',
    è: 'e', é: 'e', ê: 'e', ë: 'e', ē: 'e', ė: 'e', ę: 'e', ě: 'e',
    ì: 'i', í: 'i', î: 'i', ï: 'i', ī: 'i', į: 'i',
    ñ: 'n', ń: 'n', ň: 'n',
    ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o', ō: 'o',
    ù: 'u', ú: 'u', û: 'u', ü: 'u', ū: 'u', ů: 'u',
    ý: 'y', ÿ: 'y',
    ž: 'z', ź: 'z', ż: 'z',
    ß: 'ss', æ: 'ae', œ: 'oe',
    À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Å: 'A',
    Ç: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E',
    Ì: 'I', Í: 'I', Î: 'I', Ï: 'I',
    Ñ: 'N', Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O', Ø: 'O',
    Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U', Ý: 'Y',
  }),
);

/**
 * Produce an ASCII-only fallback for a filename: accented Latin letters
 * are transliterated, any remaining non-ASCII characters are dropped, and
 * control characters are stripped.  The result is intended to be wrapped
 * in a `quoted-string` by {@link quoteFilename}.
 *
 * @param filename  The original, possibly non-ASCII filename.
 * @returns         An ASCII approximation (never empty: falls back to
 *                  `"file.pdf"` if nothing survives).
 */
function asciiFallback(filename: string): string {
  let out = '';
  for (const char of filename) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x20 && code < 0x7f) {
      // Printable ASCII — keep as-is.
      out += char;
    } else {
      const replacement = TRANSLITERATIONS.get(char);
      if (replacement !== undefined) {
        out += replacement;
      }
      // Otherwise drop the character entirely.
    }
  }
  out = out.trim();
  return out.length > 0 ? out : 'file.pdf';
}

/**
 * Escape a string for use inside an HTTP `quoted-string` (RFC 9110 /
 * RFC 2616): backslash and double-quote are backslash-escaped.
 *
 * @param value  An ASCII string.
 * @returns      The escaped contents (without the surrounding quotes).
 */
function quoteFilename(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Returns `true` when the string contains only printable ASCII and no
 * characters that would be illegal in a `quoted-string` filename.
 */
function isSimpleAscii(filename: string): boolean {
  for (const char of filename) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code >= 0x7f) return false;
  }
  return true;
}

/**
 * Build the value of the `Content-Disposition` header.
 *
 * @param download  `true` → `attachment`; otherwise `inline`.
 * @param filename  Optional suggested filename.
 * @returns         A complete header value, e.g.
 *                  `attachment; filename="report.pdf"` or, for non-ASCII,
 *                  `attachment; filename="resume.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`.
 */
function contentDisposition(download: boolean, filename: string | undefined): string {
  const type = download ? 'attachment' : 'inline';
  if (filename === undefined || filename.length === 0) {
    return type;
  }

  if (isSimpleAscii(filename) && !filename.includes('"') && !filename.includes('\\')) {
    // Fast path: a plain ASCII filename with no quoting hazards.
    return `${type}; filename="${filename}"`;
  }

  const fallback = asciiFallback(filename);
  const quoted = quoteFilename(fallback);

  if (isSimpleAscii(filename)) {
    // ASCII, but contained `"` or `\` — only the quoted-string form is
    // needed (no `filename*` required for pure ASCII).
    return `${type}; filename="${quoted}"`;
  }

  // Non-ASCII: emit both the ASCII fallback and the RFC 5987 ext-value.
  const extValue = encodeRfc5987(filename);
  return `${type}; filename="${quoted}"; filename*=UTF-8''${extValue}`;
}

// ---------------------------------------------------------------------------
// pdfHeaders
// ---------------------------------------------------------------------------

/**
 * Build the set of HTTP response headers for serving a PDF body.
 *
 * Always includes `Content-Type: application/pdf`, a numeric
 * `Content-Length`, and a `Content-Disposition` (`inline` by default,
 * `attachment` when `options.download` is `true`).  `Cache-Control` and
 * `Last-Modified` are added only when supplied.
 *
 * Custom headers from `options.headers` are merged first so the core PDF
 * headers always win on conflict.
 *
 * @param byteLength  Length of the PDF body in bytes (the `Content-Length`).
 * @param options     Optional response shaping (see {@link PdfResponseOptions}).
 * @returns           A plain object of header name → value.
 */
export function pdfHeaders(byteLength: number, options?: PdfResponseOptions): Record<string, string> {
  const opts = options ?? {};

  // Start from any custom headers so the core ones below override them.
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };

  headers['Content-Type'] = 'application/pdf';
  headers['Content-Length'] = String(byteLength);
  headers['Content-Disposition'] = contentDisposition(opts.download === true, opts.filename);

  if (opts.cacheControl !== undefined) {
    headers['Cache-Control'] = opts.cacheControl;
  }
  if (opts.lastModified !== undefined) {
    headers['Last-Modified'] = opts.lastModified.toUTCString();
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Feature-detect the Web-standard `Response` constructor.
 *
 * @throws Error when `Response` is not a constructor in the current runtime.
 */
function assertResponseAvailable(): void {
  if (typeof Response !== 'function') {
    throw new Error(
      'pdfResponse: the Web-standard `Response` constructor is not available in this runtime. ' +
        'Use `sendPdfToNodeResponse(res, bytes)` for a classic Node `http.ServerResponse`, ' +
        'or upgrade to a runtime with the Fetch API (Node >=18, Deno, Bun, Cloudflare Workers, browsers).',
    );
  }
}

// ---------------------------------------------------------------------------
// pdfResponse
// ---------------------------------------------------------------------------

/**
 * Build a Web-standard {@link Response} that streams the given PDF bytes
 * to the client with the correct headers and status code.
 *
 * Works in any runtime with the Fetch API: Cloudflare Workers, Deno, Bun,
 * Node >=18, and browsers (e.g. inside a Service Worker).
 *
 * @param bytes    The PDF body.
 * @param options  Optional response shaping (see {@link PdfResponseOptions}).
 * @returns        A `Response` with status `options.status ?? 200`.
 * @throws         If the runtime lacks the `Response` constructor.
 */
export function pdfResponse(bytes: Uint8Array, options?: PdfResponseOptions): Response {
  assertResponseAvailable();
  const opts = options ?? {};
  const headers = pdfHeaders(bytes.byteLength, opts);
  // Copy into a fresh ArrayBuffer-backed view so the body is a valid
  // BodyInit regardless of how the caller allocated `bytes` (e.g. a view
  // into a larger/shared buffer).
  const body = bytes.slice();
  return new Response(body, {
    status: opts.status ?? 200,
    headers,
  });
}

// ---------------------------------------------------------------------------
// pdfStreamResponse
// ---------------------------------------------------------------------------

/**
 * Build a streaming Web-standard {@link Response} from a
 * `ReadableStream` of PDF bytes (e.g. from `doc.saveAsStream()`).
 *
 * Because the total size is generally unknown up-front, `Content-Length`
 * is **omitted** unless `options.byteLength` is supplied — allowing the
 * runtime to use chunked transfer encoding.
 *
 * @param stream   A readable stream of the PDF body.
 * @param options  Response shaping plus an optional known `byteLength`.
 * @returns        A streaming `Response`.
 * @throws         If the runtime lacks the `Response` constructor.
 */
export function pdfStreamResponse(
  stream: ReadableStream<Uint8Array>,
  options?: PdfResponseOptions & { byteLength?: number | undefined },
): Response {
  assertResponseAvailable();
  const opts = options ?? {};

  // When the byte length is known we can advertise it; otherwise we must
  // not send a Content-Length (the body is delivered with chunked encoding).
  const headers =
    opts.byteLength !== undefined
      ? pdfHeaders(opts.byteLength, opts)
      : (() => {
          const h = pdfHeaders(0, opts);
          delete h['Content-Length'];
          return h;
        })();

  return new Response(stream, {
    status: opts.status ?? 200,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Node (Express / http.ServerResponse) helper
// ---------------------------------------------------------------------------

/**
 * The minimal structural shape of a Node `http.ServerResponse` (also
 * satisfied by Express's `res`).  Declared inline so that this module
 * never imports `node:http` and stays runtime-agnostic.
 */
export interface NodeServerResponseLike {
  /** Write the status line and response headers. */
  writeHead(status: number, headers: Record<string, string>): void;
  /** Write the final body chunk and end the response. */
  end(chunk: Uint8Array): void;
}

/**
 * Send a PDF body to a classic Node-style response object
 * (`http.ServerResponse` or Express `res`).
 *
 * This calls {@link NodeServerResponseLike.writeHead} with the status and
 * {@link pdfHeaders}, then {@link NodeServerResponseLike.end} with the body.
 *
 * @param res      The response object (structural typing — no import).
 * @param bytes    The PDF body.
 * @param options  Optional response shaping (see {@link PdfResponseOptions}).
 */
export function sendPdfToNodeResponse(
  res: NodeServerResponseLike,
  bytes: Uint8Array,
  options?: PdfResponseOptions,
): void {
  const opts = options ?? {};
  const headers = pdfHeaders(bytes.byteLength, opts);
  res.writeHead(opts.status ?? 200, headers);
  res.end(bytes);
}
