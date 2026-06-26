# modern-pdf-lib — Roadmap to 1.0.0

> Granular, per-patch release plan from the current **0.27.0** through **1.0.0**.
> Versioning follows [`VERSIONING.md`](./VERSIONING.md): patch `.0–.9`, then roll to the next minor.
> Effort key: **S** ≤1 day · **M** a few days · **L** ~1–2 weeks · **XL** multi-week.

**Within each minor:** `.0` lays the load-bearing foundation, `.1–.8` ship individually-releasable sub-features that progressively complete the theme, and `.9` is stabilization (edge-cases, performance, tests, docs, benchmarks) before rolling to the next minor.

**1.0.0 reconciliation:** `VERSIONING.md` allows minors up to `0.99` before `1.0.0`. That's *headroom*, not a mandate — `1.0.0` ships when the library is **ISO 32000-2 feature-complete with a frozen, semver-guaranteed public API** (reached after `0.40.x` below). Recommend amending the policy to make 1.0.0 milestone-driven rather than mechanically gated on `0.99.9`.

---

## 0.27.x — Evergreen Modernization *(in progress)*
The bleeding-edge toolchain migration + code modernization.

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.27.1** | Evergreen toolchain upgrade | TS 7.0.1-rc (native), oxlint+tsgolint, oxc `isolatedDeclarations` dts, Vite 8.1 / Vitest 5, Node 26.4 / Rust beta, all deps newest across channels. **✅ done & verified green** | L |
| **0.27.2** | Lint-to-zero + bug fixes | Drive oxlint to zero (unused-vars, `no-base-to-string`, `no-misused-spread`) and fix the 4 `no-dupe-else-if` likely-bugs it surfaced. | M |
| **0.27.3** | ES2024/25 idiom pass | Adopt `toSorted`/`toReversed`/`with`, `Promise.withResolvers`, `Array.fromAsync`, `Object.groupBy`, iterator helpers, `Uint8Array` base64/hex across all modules. | M |
| **0.27.4** | Formatting & line-endings | LF normalization (`.gitattributes`), consistent formatter pass (Prettier / evaluate oxfmt when stable). | S |
| **0.27.5** | Benchmark refresh | Re-run the pdf-lib comparison suite on the new stack; publish updated numbers. | S |
| **0.27.6** | Docs regeneration | Regenerate API docs via the TS6 typedoc sidecar; document the new toolchain + migration. | M |
| **0.27.7** | WASM / perf polish | SIMD feature-probe groundwork, warm WASM module cache, hot-path micro-opts. | M |
| **0.27.8** | Dependency re-audit & bug sweep | Re-run the registry audit (evergreen), bump anything newly released, fix stragglers. | S |
| **0.27.9** | Release hardening | Final green gate (typecheck/build/test/lint), changelog, tag → roll to 0.28.0. | S |

---

## 0.28.x — Reading & Extraction
*The library's biggest gap: it can create but not read. This minor adds full text/structure extraction.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.28.0** | Content-stream parser to object model | Tokenize/parse page content streams (BT/ET, Tj/TJ, Tm/Td, cm, Do, gs) into a typed operator model with resolved CTM/text-matrix — the layer all extraction builds on. | XL |
| **0.28.1** | Positioned glyph extraction | Per-glyph records with device-space x/y, advance, font, color, rotation by composing Tm×Tf×CTM (ISO 32000-2 §9.4.4). | L |
| **0.28.2** | ToUnicode + Identity-H CID decoding | Map char codes→Unicode via ToUnicode CMap; decode 2-byte Identity-H CID strings for subset/CJK fonts (§9.10.3). | L |
| **0.28.3** | Word/line/paragraph reconstruction | Cluster glyphs into reading-order runs via baseline/gap/column heuristics; `getTextContent()`. | L |
| **0.28.4** | Tagged StructTreeRoot extraction | Walk the logical structure tree with MCID mapping (§14.7) to extract H1–H6/P/Table/Figure as a typed tree. | L |
| **0.28.5** | Marked-content artifact filter | Honor BDC/BMC + `/Artifact` (§14.6) to skip headers/footers/page numbers during extraction. | M |
| **0.28.6** | Table extraction to grid/CSV/JSON | Ruling-line + whitespace clustering → cell grids with spans → 2D array/CSV/JSON. | XL |
| **0.28.7** | In-page regex search with hit-rects | String/RegExp search returning per-match bounding boxes spanning glyph runs. | M |
| **0.28.8** | Annotation & link extraction | Extract Link/Text/Highlight annots with QuadPoints; resolve URI/GoTo targets (§12.5). | M |
| **0.28.9** | Damaged-xref repair + hardening | Rebuild broken xref/object streams by scanning `N G obj`; extraction fuzzing, benchmarks vs pdf-lib/pdf.js, docs. | L |

---

## 0.29.x — Rendering & Rasterization
*Turn PDFs into pixels: a content interpreter + WASM rasterizer unlock thumbnails, previews, OCR, and visual diffing.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.29.0** | Content-stream interpreter core | Graphics-state machine executing operators (q/Q/cm, m/l/c/re, f/S/W, Tf/Td/TJ, gs) into a resolution-independent display list. | XL |
| **0.29.1** | WASM page rasterizer → RGBA/PNG | `renderPageToImage()`: scanline rasterizer (AA fills, even-odd/nonzero, alpha) → RGBA8888 + PNG at any DPI. | XL |
| **0.29.2** | Canvas / OffscreenCanvas adapter | `renderPageToCanvas()` for browser + Workers with devicePixelRatio scaling. | M |
| **0.29.3** | Thumbnail generation + /Thumb reader | `generateThumbnail()`; read/write page `/Thumb` XObjects (§12.3.4). | M |
| **0.29.4** | Embedded image extraction + SMask compositing | `extractImages()` decoding every XObject/inline image with colorspace + `/SMask`/`/Mask` compositing (§11.6.5). | L |
| **0.29.5** | Embedded font extraction → TTF/OTF/CFF | `extractFonts()` rebuilding standalone font files from FontFile/2/3 + Encoding/ToUnicode. | L |
| **0.29.6** | Visual page diff (pixel + SSIM) | `comparePages()` → difference heatmap, changed-pixel count, SSIM score for visual regression. | M |
| **0.29.7** | Pluggable OCR hook → invisible text | `OcrEngine` interface writing results as invisible Tr 3 overlay (§9.3.3); scanned PDFs become searchable. | L |
| **0.29.8** | True text redaction by content removal | `redactRegions()` deletes underlying text/image operators in rects — not a black box overlay. | L |
| **0.29.9** | Render caching, tiling & stabilization | Tile-based rendering of huge pages + LRU cache; MediaBox/CropBox/blend-mode edge cases; benchmarks + docs. | L |

---

## 0.30.x — PDF 2.0 Core (ISO 32000-2)
*The headline PDF 2.0 features no JS library ships.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.30.0** | Document Part hierarchy (DPart/DParts) | `/DPartRoot` + nested `/DPart` page-range nodes for variable-data/transactional structure. | L |
| **0.30.1** | Associated Files (doc + page) | `/AF` arrays with typed `/AFRelationship` (Source/Data/Alternative/…) so companion data travels with the doc (§7.11.4). | M |
| **0.30.2** | Associated Files (annotation + object) | Extend `/AF` to annotations/XObjects/structure elements (§14.13) — full AF coverage. | M |
| **0.30.3** | Page/stream Output Intents | Per-page & per-stream `/OutputIntents` with ICC `/DestOutputProfile` (§14.11.5) — mixed render targets. | M |
| **0.30.4** | Structure Namespaces | `/Namespaces` + per-element `/NS` + `/RoleMapNS` (§14.7.4) so MathML/PDF-2.0/custom vocabularies coexist. | L |
| **0.30.5** | Document `/Requirements` | Catalog `/Requirements` declaring needed processor capabilities with `/RH` handlers (§7.12.7). | S |
| **0.30.6** | Unencrypted wrapper / encrypted payload | Clear-text wrapper around an `/EncryptedPayload` body for DRM/secure-mail readers (§7.6.7). | L |
| **0.30.7** | Luminosity/alpha soft-mask groups | ExtGState `/SMask` Luminosity & Alpha groups with `/TR`/`/BC` (§11.6.5.2) — vector soft masks & fades. | L |
| **0.30.8** | Image soft masks + black-point comp | Image `/SMask`, stencil/color-key `/Mask` (§8.9.6), `/UseBlackPtComp` (§8.6.5.9). | L |
| **0.30.9** | PieceInfo + theme stabilization | `/PieceInfo` private app data (§14.5); fuzz fixtures, soft-mask benchmarks, full PDF 2.0 docs. | XL |

---

## 0.31.x — Tagged PDF & Accessibility (PDF/UA-2)
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.31.0** | Structure-tree authoring core | Build StructTreeRoot/StructElem/ParentTree + BDC/EMC marked content (MCID) for generated content. | XL |
| **0.31.1** | Standard structure-type tagging | High-level helpers emitting Document/Sect/P/Span/Figure/Link auto-wired to content. | L |
| **0.31.2** | Heading & list structure helpers | H1–H6 + List/LI/Lbl/LBody with ListNumbering (Table 384). | M |
| **0.31.3** | Table-structure tagging | Table/TR/TH/TD with Scope + Headers/ID for screen-reader cell relationships. | L |
| **0.31.4** | Alt-text / ActualText / artifacts | Alt/ActualText/E expansion + Artifact marking (§14.8.2.2). | M |
| **0.31.5** | Document language + Lang spans | Catalog `/Lang` (BCP 47) + per-element Lang for multilingual pronunciation (§14.9.2). | M |
| **0.31.6** | Namespace & role-map (MathML, ARIA) | Namespaces + RoleMapNS + MathML/ARIA structure required by PDF/UA-2. | L |
| **0.31.7** | PDF/UA-2 conformance + XMP | ISO 14289-2 writer enforcing tagging, MarkInfo, `pdfuaid:part=2`. | L |
| **0.31.8** | Accessibility checker + auto-tagging | Matterhorn 1.1 / PAC checker, reading/Tab-order validation, structure inference for untagged PDFs. | XL |
| **0.31.9** | Stabilization | Malformed-tree hardening, MCID/ParentTree perf, veraPDF/PAC tests, docs. | L |

---

## 0.32.x — Next-Gen Standards & Validation
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.32.0** | Output-intent manager + ICC registry | Central ICC registry, OutputIntent dicts (GTS/CGATS), doc + page intents. | L |
| **0.32.1** | PDF/A-4 conformance writer core | ISO 19005-4 on PDF 2.0 syntax; reduced ruleset; passes veraPDF. | XL |
| **0.32.2** | PDF/A-4 XMP extension schema | `pdfaid:part=4` + auto extension-schema for custom XMP namespaces. | M |
| **0.32.3** | PDF/A-4e & PDF/A-4f levels | Engineering (3D/RichMedia) + embedded-file levels. | L |
| **0.32.4** | PDF/X-6 print-production | ISO 15930-9 with TrimBox/BleedBox, output intent, GTS_PDFXVersion. | L |
| **0.32.5** | PDF/VT-2/3 variable printing | ISO 16612-2 on PDF/X-6 with DPart/DPM + reusable encapsulation groups. | XL |
| **0.32.6** | WTPDF + PDF/R writers | Wide Tagged PDF (reflow) + ISO 23504 raster/scanned profile. | L |
| **0.32.7** | Structured validation report | JSON + veraPDF MRR + **SARIF 2.1.0** with clause refs & locators. | L |
| **0.32.8** | Profile up/downgrade + preflight fixups | Auto A-3↔A-4, X-4↔X-6; mechanical repair of common failures. | L |
| **0.32.9** | Validation stabilization | Streaming validation, malformed-ICC/DPart fuzzing, conformance guides. | L |

---

## 0.33.x — E-Invoicing & Document Assembly
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.33.0** | PDF/A-3 embedded-file core | `/EmbeddedFile` + `/AFRelationship` + Params(CheckSum/ModDate/Size) + EmbeddedFiles tree. | L |
| **0.33.1** | Embedded-file manager | Enumerate/extract/MIME/relationship/remove across name tree + `/AF`. | M |
| **0.33.2** | Factur-X / ZUGFeRD 2.x XML generator | CII UN/CEFACT XML for MINIMUM…EXTENDED profiles from a typed model. | XL |
| **0.33.3** | Hybrid Factur-X PDF/A-3 assembler | Attach `factur-x.xml` + Factur-X XMP extension schema for validator/ERP recognition. | L |
| **0.33.4** | XRechnung & Order-X profiles | XRechnung 3.x (CII+UBL, BT-DE) + Order-X lifecycle. | L |
| **0.33.5** | E-invoice XML validation | UN/CEFACT XSD + EN16931/XRechnung/Order-X Schematron with BT-/BG- diagnostics. | XL |
| **0.33.6** | ZUGFeRD / Factur-X reader + validator | Inbound parse via `/AF`, profile from XMP, typed model, validate, roundtrip. | L |
| **0.33.7** | PDF Portfolios / Collections | `/Collection` (View/Schema/Sort/CI) + hierarchical `/Folders` (§7.11.6). | L |
| **0.33.8** | Cover-sheet + batch assembly | Portfolio cover sheet + many-invoice batch pipeline + `/Requirements`. | M |
| **0.33.9** | Deterministic output + hardening | Reproducible builds (fixed `/ID`, pinned dates, C14N XML), conformance tests, docs. | L |

---

## 0.34.x — Advanced Signatures (PAdES)
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.34.0** | PAdES-B-B baseline | ETSI EN 319 142-1 CAdES-BES detached CMS (ETSI.CAdES.detached). | L |
| **0.34.1** | CAdES signed attributes | ESS signing-certificate-v2, commitment-type, signer-location, signing-time. | M |
| **0.34.2** | PAdES-B-T timestamp | RFC 3161 signature-timestamp as unsigned attribute. | M |
| **0.34.3** | RSASSA-PSS + EdDSA + det-ECDSA | RFC 8017 PSS, Ed25519 (RFC 8032), deterministic ECDSA (RFC 6979) via WebCrypto. | L |
| **0.34.4** | External deferred-hash signer | `ExternalSigner` for PKCS#11 HSM / WebCrypto / cloud KMS — keys never exposed. | L |
| **0.34.5** | DSS + VRI (PAdES-B-LT) | `/DSS` Certs/CRLs/OCSPs + per-sig VRI (§12.8.4.3) for offline long-term validation. | L |
| **0.34.6** | Standalone DocTimeStamp | ETSI.RFC3161 timestamp over the whole ByteRange (§12.8.5). | M |
| **0.34.7** | PAdES-B-LTA + re-timestamping | Archive timestamp chain + B-LT→B-LTA renewal before expiry. | L |
| **0.34.8** | Trust-path hardening | RFC 5280 path processing: EKU, name constraints, AIA fetch, policy OIDs. | L |
| **0.34.9** | Appearance templating + stabilization | Declarative signature appearance (n2 layer + logo); conformance tests/docs. | L |

---

## 0.35.x — Security & Sanitization
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.35.0** | Public-key (certificate) encryption | Adobe.PubSec handler, PKCS#7 enveloped CMS per-recipient — opens with a private key. | XL |
| **0.35.1** | AES-GCM (AESV4) crypt filter | Authenticated AES-256-GCM streams/strings with tamper-detecting tags. | L |
| **0.35.2** | Permission-bit enforcement | Validate `/P` flags + AESV3/V4 `/Perms` 12-byte block (§7.6.4). | M |
| **0.35.3** | Password policy + KDF hardening | R6 hardened KDF (Algorithm 2.B), SASLprep, constant-time U/O validation. | M |
| **0.35.4** | Threat-scanner / active-content sanitizer | Strip JavaScript/OpenAction/AA/Launch/URI/SubmitForm/GoToR/ImportData/RichMedia + report. | L |
| **0.35.5** | Embedded-file & attachment purge | Remove embedded files / polyglot payloads while preserving the visible doc. | M |
| **0.35.6** | Hidden-data & metadata scrubber | Flatten incremental history; strip OCG/comments/PieceInfo/XMP history. | L |
| **0.35.7** | Redaction burn-in verifier | Audit that `/Redact` regions truly removed content with no recoverable copy. | L |
| **0.35.8** | Byte-range + DocMDP coverage analyzer | Verify signatures cover the whole file; harden `/DocMDP` transform params. | L |
| **0.35.9** | Tamper-evidence report + hardening | Unified report (encryption/perms/sanitization/redaction/coverage) + fuzz tests. | M |

---

## 0.36.x — Fonts, Text & Internationalization
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.36.0** | Unicode Bidi reordering core | UAX #9 embedding-level resolution + visual reordering — the shaping-pipeline foundation. | XL |
| **0.36.1** | Complex-script shaping (Arabic/Indic) | GSUB/GPOS joining forms + Indic reordering/reph. | XL |
| **0.36.2** | OpenType feature toggle API | Per-run liga/kern/smcp/onum/frac/ss01–ss20. | L |
| **0.36.3** | WOFF/WOFF2 input decompression | WOFF (zlib) + WOFF2 (Brotli + glyf transform) → sfnt. | L |
| **0.36.4** | Variable font instancing | fvar/gvar/avar instancing (wght/wdth/opsz) → static subset. | L |
| **0.36.5** | Color fonts: COLR/CPAL + SVG + emoji | COLR/CPAL v0/v1, SVG-in-OT, VS15/VS16 + ZWJ sequences. | XL |
| **0.36.6** | Vertical writing mode (CJK) | vert/vrt2 + vmtx/VORG top-to-bottom RTL columns. | L |
| **0.36.7** | Font fallback chains | Per-glyph script splitting + coverage-based fallback (no tofu). | M |
| **0.36.8** | Knuth-Plass + hyphenation + kashida | Optimal line-breaking, Liang/TeX hyphenation, Arabic tatweel justification. | XL |
| **0.36.9** | i18n stabilization | Isolates/mirrored brackets/dotted-circle; shaping cache; UAX #9 conformance tests. | L |

---

## 0.37.x — Graphics & Color
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.37.0** | PDF function objects (types 0/2/3/4) | Sampled, exponential, stitching, PostScript-calculator — shared eval core. | XL |
| **0.37.1** | Device-independent color (CalRGB/CalGray/Lab) | White-point/gamma/matrix + Lab→XYZ→sRGB (§8.6.5). | L |
| **0.37.2** | ICC v4 parser + transform engine | ICCBased v4 + perceptual/relative/saturation intents → sRGB. | XL |
| **0.37.3** | Function-based shading (type 1) | 2D-domain function shading; unified Shading API with axial/radial. | L |
| **0.37.4** | Mesh shadings (types 4–7) | Gouraud triangle meshes + Coons/tensor patches with binary stream encoding. | XL |
| **0.37.5** | Tiling patterns (PaintType 1 & 2) | Colored/uncolored cells, BBox/XStep/YStep, pattern matrices. | L |
| **0.37.6** | Blend modes | All 16 separable + non-separable modes via ExtGState `/BM` (§11.3.5). | L |
| **0.37.7** | Transparency groups + soft masks | Isolated/knockout groups + luminosity/alpha SMask (§11.4.7, §11.6.5.2). | XL |
| **0.37.8** | Overprint + spot preview | OP/op/OPM + Separation/DeviceN overprint-preview compositor. | M |
| **0.37.9** | Graphics stabilization | Gradient-mesh helpers, NaN/degenerate hardening, fuzz + render benchmarks. | L |

---

## 0.38.x — Imaging & Media
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.38.0** | Modern codec embed core | Unified RGBA/CMYK decode → Image XObject (ColorSpace/BPC/SMask/filters) backbone. | L |
| **0.38.1** | AVIF decode + embed | AV1 still-image (10/12-bit, alpha) → Image XObject. | L |
| **0.38.2** | JPEG XL decode + embed | .jxl codestream + container, alpha, wide-gamut. | L |
| **0.38.3** | HEIC decode + embed | HEVC-coded heic/mif1 with alpha + orientation. | L |
| **0.38.4** | ICC-tagged image embedding | Carry source ICC as ICCBased colorspace (PDF/A-safe). | M |
| **0.38.5** | Lossless JPEG→JXL + size optimizer | Bit-exact transcode + document-wide image recompression/dedup. | L |
| **0.38.6** | Down-sampling preflight | Detect over-DPI images, down-sample/recompress with bytes-saved report. | M |
| **0.38.7** | Halftones + transfer functions | Halftone types 1/5/6/10/16 (§10.6) + transfer functions (§10.4). | L |
| **0.38.8** | Advanced SVG + chart helpers | filter/clipPath/pattern/mask via soft masks; bar/line/pie → vector PDF; APNG/GIF frames. | XL |
| **0.38.9** | Imaging stabilization | Codec fuzzing, WASM-worker parallel decode, benchmarks vs pdf-lib. | M |

---

## 0.39.x — Performance & Concurrency
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.39.0** | Worker-pool orchestrator | hardwareConcurrency-aware pool, task queue, transferable handoff, single-thread fallback. | L |
| **0.39.1** | SharedArrayBuffer + Atomics zero-copy | SAB ring buffer + Atomics signaling (crossOriginIsolated-gated) to WASM workers. | L |
| **0.39.2** | SIMD WASM + runtime detection | wasm32 128-bit SIMD deflate/png/jpeg with feature-probe fallback. | L |
| **0.39.3** | Lazy parse-on-access cache | Eager xref, lazy object-body parse, Map cache by obj/gen. | M |
| **0.39.4** | Memory cap + LRU eviction | Byte-budget tracking + LRU eviction (re-parseable) for huge docs. | M |
| **0.39.5** | Incremental partial parse | Open pages N..M via page-tree walk + lazy resource resolution. | L |
| **0.39.6** | HTTP Range-request lazy fetch | Linearized hint-stream-driven byte-range download (Annex F). | L |
| **0.39.7** | Streaming writer with backpressure | ReadableStream/async-iterable output honoring desiredSize. | L |
| **0.39.8** | Xref + object streams writer | Cross-reference + compressed object streams (§7.5.7/8); Flate/Brotli — 30–60% smaller. | L |
| **0.39.9** | Concurrency hardening | Async-generator page streaming, worker-crash recovery, stress tests, benchmarks. | M |

---

## 0.40.x — Developer Experience & Ecosystem
| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.40.0** | Declarative VDOM-to-PDF core | Framework-agnostic reconciler: Document/Page/View/Text/Image → content streams. | XL |
| **0.40.1** | JSX-to-PDF renderer | jsx/jsxs/Fragment runtime + `renderToPdf(<Document/>)` + TSX typings. | L |
| **0.40.2** | React / Vue / Svelte bindings | `<PDFDocument>/<PDFPage>/<PDFText>` adapters on the shared reconciler. | L |
| **0.40.3** | Template engine + typed literals | Reusable templates + `pdf\`...\`` tagged literal with schema-inferred placeholder types. | M |
| **0.40.4** | Markdown-to-PDF | CommonMark/GFM → VDOM with typographic themes + tagged structure. | M |
| **0.40.5** | Schema-driven forms | JSON Schema / Zod → AcroForm fields with flags/validation/calc order. | L |
| **0.40.6** | Server framework adapters | Next.js / Hono / Express streaming adapters with correct headers + backpressure. | M |
| **0.40.7** | Error DX + typed hooks | Codeframes, did-you-mean, doc links; onPageRendered/onFontEmbed/onError hooks. | M |
| **0.40.8** | CLI subcommands + REPL + plugin registry | render/markdown/form/inspect + REPL + marketplace plugin client. | L |
| **0.40.9** | Bundle audit + starter kits | Per-export byte-cost audit, Next/Vite/Svelte starters, reconciler fuzzing, DX docs. | L |

---

## 1.0.0 — Stable
**The milestone.** Declared once the above ships:
- **ISO 32000-2 (PDF 2.0) feature-complete** across create / read / render / sign / validate.
- **Frozen public API** with semver guarantees; all deprecations from the 0.x line removed.
- **Conformance**: PDF/A-4, PDF/UA-2, PDF/X-6 writers + validators green against veraPDF.
- **Performance**: documented wins vs pdf-lib across the full benchmark matrix; streaming + worker-parallel paths stable.
- **LTS line** begins; published support/versioning policy.
