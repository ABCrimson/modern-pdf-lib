# Changelog

## 0.1.0 (2026-02-25)

### Features
- **PDF Creation**: Full document creation with text, fonts (standard 14 + TrueType), images (PNG/JPEG), shapes, colors, opacity
- **PDF Parsing**: Complete parser supporting PDF 1.0-2.0, all xref formats, all stream filters, lazy object resolution
- **Text Extraction**: Full text extraction with positions, font tracking, ToUnicode CMap support
- **Page Manipulation**: Insert, remove, move, rotate, crop, resize pages
- **Document Merge/Split**: Merge multiple PDFs, split by page ranges, cross-document page copy with resource deduplication
- **Incremental Save**: Append-only saves preserving original bytes and signatures
- **Forms (AcroForm)**: Read, write, fill, flatten — text fields, checkboxes, radio groups, dropdowns, listboxes, buttons, signature fields
- **Annotations**: Full annotation support — text, link, freetext, highlight, underline, strikeout, squiggly, line, square, circle, polygon, polyline, stamp, ink, redact
- **Encryption**: RC4-40, RC4-128, AES-128, AES-256 encryption/decryption with password verification
- **Digital Signatures**: PKCS#7/CMS signing with RSA/ECDSA, signature verification, RFC 3161 timestamps
- **Bookmarks/Outlines**: Full outline tree with nested bookmarks, colors, styles, all fit modes
- **XMP Metadata**: Generate and parse XMP metadata packets with Dublin Core/XMP/PDF namespaces
- **Viewer Preferences**: All 12 viewer preference fields
- **Tagged PDF / Accessibility**: Structure tree, marked content, PDF/UA validation with 13 check codes
- **SVG Import**: Parse and render SVG paths, shapes, colors, transforms
- **PDF/A Compliance**: Validation and enforcement for PDF/A-1b through PDF/A-3u
- **Optional Content (Layers)**: Create, manage, and render content in layers
- **Embedded Files**: Attach and retrieve file attachments
- **Watermarks**: Text watermarks with custom styling, opacity, rotation
- **Redaction**: Two-step redaction (mark + apply) with overlay text
- **Streaming Output**: `ReadableStream` and `Blob` output for serverless/edge
- **Object Streams**: Cross-reference streams for smaller file sizes
- **Universal Runtime**: Works in Node.js, Deno, Bun, Cloudflare Workers, browsers — ESM-only, zero Buffer usage
