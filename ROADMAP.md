# modern-pdf-lib — Roadmap to 1.0.0

> Granular, per-patch release plan from the current **0.28.0** through **1.0.0**.
> Versioning follows [`VERSIONING.md`](./VERSIONING.md): patch `.0–.9`, then roll to the next minor.
> Effort key: **S** ≤1 day · **M** a few days · **L** ~1–2 weeks · **XL** multi-week.

**Within each minor:** `.0` lays the load-bearing foundation, `.1–.8` ship individually-releasable sub-features that progressively complete the theme, and `.9` is stabilization (edge-cases, performance, tests, docs, benchmarks) before rolling to the next minor.

**1.0.0 reconciliation:** `VERSIONING.md` allows minors up to `0.99` before `1.0.0`. That's *headroom*, not a mandate — `1.0.0` ships when the library is **ISO 32000-2 feature-complete with a frozen, semver-guaranteed public API** (reached after `0.50.x` below). Recommend amending the policy to make 1.0.0 milestone-driven rather than mechanically gated on `0.99.9`.

---

## 0.27.x — Evergreen Modernization *(shipped in 0.28.0)*
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

## 0.28.x — Reading & Extraction *(shipped in 0.28.0)*
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

## 0.29.x — Rendering & Rasterization *(shipped in 0.29.0)*
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

## 0.41.x — Print Production & Prepress
*Drive PDF straight onto the press: in-RIP separations, trapping, imposition, ink limiting, and prepress marks for ISO 12647 production.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.41.0** | Separation & in-RIP color pipeline | Per-page colorant model atop existing Separation/DeviceN (§8.6.6.4): named-ink registry, alternate/tint-transform graph, overprint OP/op + OPM (§8.6.7.1, §11.7.4.5), `/Separation_info` plate enumeration, host-side plate compositor producing per-colorant grayscale buffers. | XL |
| **0.41.1** | ICC DeviceLink & ink-coverage limiting | DeviceLink ICC profile application (ICC.1:2022 §8.4 multiProcessElements/AToB) for CMYK→CMYK retarget; TAC/TIC enforcement (e.g. 240/300/320%), GCR/UCR ink reallocation, black-generation curves per ISO 12647-2 substrate classes. | L |
| **0.41.2** | Trapping engine | Vector spread/choke trap generation with neutral-density-driven direction, configurable trap width/miter, sliding/centerline traps, pullback on rich black, `/Trapped` flag (§14.11.6) + TrapNet-style intent annotation. | L |
| **0.41.3** | N-up imposition & booklet layout | Imposition engine: step-and-repeat, cut-and-stack, saddle-stitch/perfect-bound signatures, creep/shingling compensation, gutter/bleed control, page reordering via printer's spreads onto press-sheet `/MediaBox`+`/BleedBox`+`/TrimBox` (§14.11.2). | L |
| **0.41.4** | Printer's marks & color bars | Registration targets, crop/trim/bleed/fold marks, star targets, slug/job-ticket text, ISO 12647-/Ugra-Fogra control strips and gray-balance/solid-ink color bars placed in mark zone outside TrimBox. | M |
| **0.41.5** | Soft-proofing & gamut simulation | ICC absolute/relative-colorimetric proof transform with paper-white & black-point simulation, out-of-gamut highlighting, BPC toggle (ICC §F), proof-condition (DeviceN→monitor RGB) for substrate-accurate on-screen rendering. | L |
| **0.41.6** | Overprint & flattening preview | Composite preview honoring overprint/knockout, spot-vs-process interaction, transparency-group blending under separations; flatten-for-press path emitting opaque DeviceN content with preserved overprint semantics. | M |
| **0.41.7** | PDF/X print-path export | PostScript Level 3 / DSC 3.0 separated & composite export, `setcmykcolor`/`setoverprint`/Separation colorspace emission, OutputIntent→ICC link mapping, plus PJTF/JDF (CIP4) job-ticket emission for press handoff. | L |
| **0.41.8** | Preflight & Ghent-spec validation | Prepress preflight engine: min-resolution, hairline, RGB-in-CMYK-job, missing-OutputIntent, TAC-over-limit, font-embedding, spot-count checks against Ghent Workgroup (GWG) 2022 profiles, machine-readable report. | L |
| **0.41.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.42.x — 3D, Rich Media & Multimedia
*Resurrect interactive 3D, embedded media, and rendition-driven presentations — the post-Flash multimedia stack of ISO 32000-2 §13.6.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.42.0** | 3D annotation & stream core | `Subtype /3D` annot + `3DD` stream (§13.6.2), `/Type /3D` w/ `/Subtype /U3D` (ECMA-363) & `/PRC` (ISO 14739-1); `3DV`/`3DA` activation dict, `VA` views array, default `/U3DPath`. | XL |
| **0.42.1** | 3D views & camera | `3DView` dicts (§13.6.4) — `MS` (matrix/none/U3D), `C2W` camera-to-world 12-elem matrix, `CO` center-of-orbit, `U3DPath` named view binding, `XN`/`IN` external/internal names. | L |
| **0.42.2** | Lighting & render modes | `3DLightingScheme` (§13.6.4 — Artwork/White/Day/Night/Hard/Primary/Blue/Red/Cube/CAD/Headlamp) + `3DRenderMode` (Solid/Wireframe/Transparent/BoundingBox/ShadedVertices/Illustration, `AC`/`FC` aux colors). | M |
| **0.42.3** | 3D cross-sections & nodes | `3DCrossSection` array (`C` center, `O` orientation, `PO`/`PC` plane opacity/color, `IV`/`IC` intersection) + `3DNode` visibility/opacity/matrix overrides via `/Node` array (§13.6.4). | L |
| **0.42.4** | RichMedia annotation | `Subtype /RichMedia` (§13.6.2) — `RichMediaContent` w/ `Assets` name-tree, `Configurations`/`Instances` (Flash/Video/Audio/3D subtype), `RichMediaSettings` `Activation`/`Deactivation`. | M |
| **0.42.5** | Screen annot & rendition actions | `Subtype /Screen` (§12.5.6.18) + `Rendition` action (`/S /Rendition`, §12.6.4.13) — `OP` operation 0–4, media/selector renditions `MR`/`SR`, `JS` script, `AN` annot target. | L |
| **0.42.6** | Media clips & players | `MediaClip` (`MCD` data / `MCS` section §13.2.4), `MediaPlayers` `MU` must/`A` available/`NU` never lists by `SoftwareIdentifier` (`OS`/`L`/`H`), `MediaPermissions` `TF` temp-file policy. | M |
| **0.42.7** | Legacy Movie/Sound annots | `Subtype /Movie` (§12.5.6.17) + `Movie`/`MovieActivation` dicts, `Subtype /Sound` (§12.5.6.16) + `Sound` stream (`R` rate, `B` bits, `C` channels, `E` encoding), `Play Sound`/`Movie` actions (§12.6.4.10–11). | L |
| **0.42.8** | JavaScript-driven 3D | 3D scene scripting binding (§13.6.4.3) — `OnInstantiate` handler, Acrobat `Annot3D`/`Camera`/`Mesh`/`Node`/`RenderMode` JS object model, `runtime.setView`/event dispatch into sandboxed evaluator. | L |
| **0.42.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.43.x — Geospatial PDF & Measurement
*Turn pages into georeferenced maps: ISO 32000-2 §8.8 Viewport/Measure/GEO with full WKT/EPSG coordinate machinery and ruler-grade distance/area/angle measurement.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.43.0** | Viewport & Measure foundation | Page `/VP` array of Viewport dicts (§8.8.1) with `/BBox`, `/Name`, `/Measure`; dispatch to GEO vs RL measure subtypes; reader/writer round-trip + object model. | XL |
| **0.43.1** | GEO measure dict (§8.8.2) | `/GEO` subtype with `/GPTS` (geo lat/lon pairs), `/LPTS` (normalized 0–1 page coords), `/BOUNDS` neatline quad, `/GCS`/`/DCS`/`/PCS` slots, `/PDU` display units. | L |
| **0.43.2** | GCS/PCS coordinate systems | Geographic/projected CS dicts via `/WKT` (OGC 01-009 / ISO 19125) or `/EPSG` code; WGS84 (EPSG:4326) datum default, axis-order handling per ISO 19111. | M |
| **0.43.3** | Datum & projection transforms | Forward/inverse Transverse Mercator, UTM zones, Web Mercator (EPSG:3857), LCC; Helmert 7-param datum shifts; GPTS↔LPTS↔device pipeline. | L |
| **0.43.4** | Geodesic distance & area | Vincenty/Karney geodesics on the ellipsoid for `/PDU=DISTANCE/AREA`; great-circle fallback; planar shoelace area in PCS with unit scaling. | M |
| **0.43.5** | RL number-format measure (§8.8.3) | `/RL` rectilinear measure: `/X`/`/Y` axis arrays, `/D` distance, `/A` area, `/T`/`/S`/`/V` number-format dicts (`/U`,`/C`,`/F`,`/D`,`/PS`,`/SS`,`/RD`,`/RT`). | L |
| **0.43.6** | Geospatial annotations | Measurement annots carrying `/Measure` (Line/Polygon/PolyLine §12.5.6); `/IT` Intents (PolygonDimension, LineDimension); leader lines and caption text rendering. | M |
| **0.43.7** | Georeferenced raster overlays | Embed GeoTIFF/world-file rasters as XObjects with derived `/VP`+`/GEO`; reproject tie-points to page CTM; `/Measure` attached to image bbox. | L |
| **0.43.8** | Vector overlays & coord queries | GeoJSON (RFC 7946) polyline/polygon import projected to page space; `pageToGeo()`/`geoToPage()` query API; KML point/path ingest, OGC GeoPackage tie-in. | L |
| **0.43.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.44.x — Dynamic Forms & XFA Migration
*Ingest legacy XFA templates and modern dynamic forms, then losslessly-as-possible migrate them to spec-complete, fully-scriptable AcroForms.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.44.0** | XFA packet model & XDP parser | Parse the XFA stream array / XDP packet set (ISO 32000-1 §12.7.8, AcroForm `/XFA`): split `template`, `datasets`, `config`, `form`, `localeSet`, `connectionSet` into a typed DOM; resolve XFA 3.3 grammar namespaces and SOM expressions. | XL |
| **0.44.1** | Static vs dynamic classification & shell detection | Detect `/NeedsRendering`, classify forms per XFAF/XDP and full-vs-shell (XFA 3.3 §1); reconcile the legacy AcroForm fallback layer against the XFA `form` packet for hybrid documents. | L |
| **0.44.2** | Template layout engine (flowed/positioned) | Resolve `subform` layout (`positioned`/`tb`/`lr-tb`), `occur` min/max/initial, `breakBefore`/`breakAfter`, `keep`, content-area/pageSet pagination to produce a concrete box tree from the XFA template. | M |
| **0.44.3** | Migration to static AcroForm | Flatten the resolved box tree into AcroForm fields + widget annotations (§12.7.4–12.7.5), mapping `field`/`draw`/`exclGroup` to Tx/Btn/Ch/Sig with MK/DA/appearance synthesis; emit a lossy-migration report. | L |
| **0.44.4** | Full field & widget completeness | Complete all field flags (§12.7.4.1, Ff/Tf tables), comb/multiline/password/file-select, radio `/Opt` + `/AS`, listbox `/TI`/`/I` top-index & multiselect, `/RV` rich-text values (§12.7.4.3) and merged field/widget dicts. | M |
| **0.44.5** | Form data import/export | Round-trip data via XFA `datasets`, XFDF (ISO 19444-1), FDF (§12.7.8.2), and JSON; bind SOM data paths to AcroForm field names, preserving `dataGroup`/`dataValue` structure and Unicode. | L |
| **0.44.6** | Calculation-order dependency graph | Build a topological calc graph from `/CO` and XFA `calculate`/`validate` script bindings; detect cycles, derive evaluation order, and surface `dirtyNodes` recalculation semantics. | M |
| **0.44.7** | Form event model completeness | Extend the sandbox with the full XFA/AcroForm event set — `calculate`/`validate`/`enter`/`exit`/`change`/`click`/`format`/`initialize`/`docReady`/`preSave` — with `xfa.event` propagation and re-entrancy guards. | L |
| **0.44.8** | Format/validate picture clauses & FormCalc bridge | Implement XFA picture-clause `format`/`validate` patterns (date/time/num/text categories, ISO 8601 + locale) and a FormCalc→JS interop bridge for `Eval`/builtin functions referenced from calc scripts. | L |
| **0.44.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.45.x — Annotations & Collaboration
*Deliver the complete ISO 32000-2 §12.5 annotation suite with generated appearance streams, threaded markup review, and lossless FDF/XFDF interchange.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.45.0** | Annotation object model & AP engine | Core `/Annot` dictionary model (§12.5.2: Rect, Flags, AP/AS, BS/Border, OC, M/CreationDate, NM); appearance-stream generator emitting Form XObject `/N`,`/R`,`/D` streams with `/BBox`+`/Matrix` per §12.5.5. | XL |
| **0.45.1** | Markup & text annotations | Text (note icons §12.5.6.4), FreeText with `/DA`+`/RC` rich text and `/CL` callout/`/Q` justify (§12.5.6.6), `/Popup` parent linkage (§12.5.6.14). | L |
| **0.45.2** | Geometric annotations | Line (`/L`,`/LE` endings,`/CP`,`/LL`/`/LLE` leader lines §12.5.6.7), Square/Circle (`/RD`,`/IC` §12.5.6.8), Polygon/PolyLine (`/Vertices`,`/BE` cloud effect §12.5.6.9) with auto-generated AP. | M |
| **0.45.3** | Text-markup annotations | Highlight/Underline/Squiggly/StrikeOut via `/QuadPoints` (§12.5.6.10); multiply-blend highlight AP, baseline-offset squiggle/strike geometry derived from extracted glyph runs. | L |
| **0.45.4** | Ink, Stamp & rubber stamps | Ink `/InkList` path smoothing with Catmull-Rom→Bézier AP (§12.5.6.13); Stamp standard `/Name` set + custom image/vector stamps (§12.5.6.12). | M |
| **0.45.5** | File-attachment, Sound, Projection & 3D | FileAttachment `/FS` embedded-file streams + icons (§12.5.6.15), Sound (§12.5.6.16), Projection (§12.5.6.24), 3D `/3DD`/`/3DV` PRC/U3D viewport refs (§13.6). | L |
| **0.45.6** | Reply threads & review workflow | In-reply-to `/IRT` + `/RT` (Reply/Group §12.5.6.2), `/State`/`/StateModel` review status (Accepted/Rejected/Cancelled/Completed §12.5.6.3), author/`/T` threading, comment-tree traversal API. | M |
| **0.45.7** | FDF/XFDF round-trip | FDF (§12.7.8) and XFDF (ISO 19444-1) import/export of annotations + fields: parse/serialize `<annots>`,`<add>`/`<modify>`/`<delete>` deltas, embedded AP, rich-text spans; lossless re-merge into source. | L |
| **0.45.8** | Flattening & extraction | Bake AP streams into page content with OCG/print-flag awareness, redact-annotation application (§12.5.6.23 apply-and-remove), structured extraction to JSON with QuadPoints→text mapping. | L |
| **0.45.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.46.x — Document Intelligence & Layout Analysis
*Recover physical and logical document structure — reading order, regions, tables, headings, and searchable text — from glyph geometry alone, via pluggable heuristics and zero bundled ML weights.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.46.0** | Geometric content model + page graph | Build a normalized per-page geometry model from §9.4 text-showing ops and §8.6 graphics state: glyph runs with CTM-resolved quads, baselines, font/size, color, z-order; expose `LayoutModel` API with spatial R-tree index over word/line/region nodes. | XL |
| **0.46.1** | Reading-order detection | XY-cut recursive segmentation + topological ordering of blocks; honor explicit order via Tagged-PDF §14.8.2 `/StructTreeRoot` when present, else infer from column geometry and bidi base direction (UAX #9). | L |
| **0.46.2** | Physical layout segmentation | Whitespace-density + connected-component analysis into columns/regions/blocks; gutter detection, multi-column flow resolution, header/footer/margin-note classification via repetition across pages (running-head detection per §14.8.4.3). | M |
| **0.46.3** | Table-structure recognition | Detect tables from §8.5.2.1 path-ruling lines (h/v segment graph → cell grid) and whitespace lattices for borderless tables; emit row/col spans, header rows, and round-trip to Tagged-PDF `/Table`/`/TR`/`/TH`/`/TD` (§14.8.4.5). | L |
| **0.46.4** | Heading & list inference | Cluster lines into a logical outline using font-size/weight/leading deltas and indentation; detect ordered/unordered list markers (bullets, decimal/roman/alpha), nesting depth, and map to `/H1`–`/Hn`/`/L`/`/LI` structure types. | M |
| **0.46.5** | Language & script detection | Per-run Unicode script resolution (UAX #24) + n-gram language ID over extracted text; populate span `/Lang` (BCP-47, RFC 5646) hints and select shaping/segmentation rules; confidence scores per region. | L |
| **0.46.6** | Pluggable OCR pipeline + searchable overlay | Define `OcrEngine` interface (image tiles in → words+quads+confidence out, no bundled weights); render rasterized regions, run engine, inject invisible §9.3.3 `Tr 3` text layer aligned to glyph quads producing a searchable overlay. | M |
| **0.46.7** | Key-value & form extraction hooks | Heuristic label→value pairing via proximity/alignment graphs and colon/underline cues; expose `FieldExtractor` plugin API and reconcile with AcroForm §12.7 widget rects when present; emit typed KV records. | L |
| **0.46.8** | Document classification hooks + structured export | `Classifier` plugin interface over layout+text features (no weights); serialize the full intelligence model to hOCR/ALTO 4.x and JSON-LD, with bbox provenance and per-node confidence. | L |
| **0.46.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.47.x — Archival & Long-Term Preservation
*OAIS-compliant ingest-to-AIP pipeline that normalizes, repairs, enriches, and packages PDFs for guaranteed multi-decade fixity and renderability.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.47.0** | OAIS fixity & manifest core | SHA-256/SHA-512/BLAKE3 fixity over per-object byte-ranges + whole-file digest; emit ISO 14721 (OAIS) manifest with RFC 8493 BagIt-style `manifest-sha512.txt`/`tagmanifest`, byte counts, and RFC 3161 timestamp anchoring of the digest set. | XL |
| **0.47.1** | PREMIS/METS preservation metadata | Embed ISO/PREMIS 3.0 events (ingest/normalization/validation/migration) + agents/rights as METS XML, serialized into XMP via a `premis:` ext-schema packet (ISO 32000-2 §14.3.2) and document-level `/Metadata`. | L |
| **0.47.2** | Deep PDF/A normalization engine | Conformance-driven rewrite to PDF/A-1/2/3 (ISO 19005-1/2/3) and PDF/A-4 (ISO 19005-4 over ISO 32000-2): strip encryption/JS/transparency-as-required, force `OutputIntent`, normalize `/MarkInfo`, set GTS_PDFA1 XMP conformance/part keys. | XL |
| **0.47.3** | Structural repair & rebuild | Reconstruct broken xref/trailer, rebuild object/xref streams (§7.5.7–7.5.8), repair `/Root`/`/Info` links, recover orphaned objects, fix `/ID` and `/Size`, and re-linearize (§F) for byte-stable AIP output. | L |
| **0.47.4** | Font completeness enforcement | Detect non-embedded/subset-incomplete fonts; embed full or widened subsets, regenerate `/CIDToGIDMap`/`/ToUnicode` (§9.10), validate `/CharSet`/`/CIDSet`, and substitute metrically-compatible fallbacks flagged as PREMIS migration events. | L |
| **0.47.5** | ICC & color completeness | Enforce explicit `OutputIntent` ICC (ICC v2/v4, ISO 15076-1), tag all DeviceN/Separation/ICCBased streams, resolve unmanaged Device* color via DefaultGray/RGB/CMYK, and validate profile presence against PDF/A color rules. | L |
| **0.47.6** | Format migration legacy→PDF 2.0 | Upgrade PDF 1.x AIPs to ISO 32000-2: rewrite deprecated constructs (XFA drop, `/Encrypt` V<5 re-key, name-tree/AcroForm cleanup), set `/Version` 2.0, and log each transform as a PREMIS migration with before/after fixity. | L |
| **0.47.7** | AIP packaging & SIP/DIP | Produce OAIS AIP as a BagIt (RFC 8493) bag or PDF Collection/Portfolio (§7.11.4) bundling source SIP, normalized PDF/A, sidecar METS/PREMIS, fixity manifest, and provenance log; emit reversible DIP export descriptor. | M |
| **0.47.8** | Preservation-policy validation | Declarative policy engine asserting PDF/A part+level, embedded-font/ICC completeness, fixity validity, and metadata presence; gate ingest with pass/fail report (machine-readable JSON + human PDF) and exit-coded CI integration. | L |
| **0.47.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.48.x — Edge & Cloud-Native Runtimes
*Make modern-pdf-lib a first-class citizen of edge/serverless isolates: sub-millisecond cold starts, range-streamed object storage, and request-scoped memory governance everywhere from CF Workers to Deno Deploy.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.48.0** | Isolate-safe runtime core | Refactor global/module singletons to request-scoped contexts; remove `import.meta.url`/FS assumptions; WinterCG Minimum Common API surface only; `AsyncLocalStorage`-style scope via per-request `RuntimeContext`; verified on Workers `nodejs_compat`, Deno Deploy, Vercel Edge, Bun. | XL |
| **0.48.1** | Streaming WASM + cold-start budget | `WebAssembly.compileStreaming`/`instantiateStreaming` from `Response`; precompiled module caching across isolate reuse; lazy per-codec module load; cold-start budget asserts (<5ms init, <1MB resident) with CI gate on V8-isolate snapshot. | L |
| **0.48.2** | Range-streaming storage adapters | Pluggable `StorageReader` over HTTP `Range` (RFC 9110 §14); R2/S3 (`GetObject` Range)/GCS (`Range` header) backends; xref-driven sparse fetch reading only touched objects via ISO 32000-2 §7.5.8 cross-reference streams. | L |
| **0.48.3** | KV / Durable Object structure cache | Serialize parsed xref + object-stream index to a compact binary blob cached in Workers KV / Deno KV; Durable Object as single-writer coherence point; content-addressed keys (SHA-256 of byte ranges) with TTL + ETag revalidation. | M |
| **0.48.4** | Request-scoped memory caps | Hard byte budget per `RuntimeContext`; streaming back-pressure on parse/render; bounded LRU object cache with eviction; `Reader.byteLength` gating to honor Workers 128MB / Edge isolate limits; deterministic OOM-prevention errors. | L |
| **0.48.5** | Signed-URL asset loading | Fetch fonts/ICC/images via pre-signed URLs (AWS SigV4, GCS V4, R2 S3-compat); short-TTL credential scoping; SSRF allowlist + redirect pinning; integrity via SRI-style SHA-384 digests on remote assets. | M |
| **0.48.6** | Streaming response writer | Emit PDF as a `ReadableStream`/`Response` body with incremental xref so first bytes flush before the document finishes; chunked-transfer friendly; linearized-first-page (ISO 32000-2 Annex F) fast path for edge previews. | L |
| **0.48.7** | Platform bindings & adapters | Thin idiomatic shims: CF Workers `fetch` handler + R2/KV bindings, Deno Deploy, Vercel Edge Functions, Netlify Edge, Bun.serve; `wrangler`/`deno.json`/`vercel.json` recipes; env-var driven storage wiring. | L |
| **0.48.8** | Durable batch & queue workers | Long jobs via CF Queues / Durable Object alarms / Deno Cron with checkpointed resumable parse-render state; idempotent message keys; partial-result spillover to R2/S3 for documents exceeding a single isolate's wall-clock/CPU budget. | L |
| **0.48.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.49.x — Reliability, Fuzzing & Differential Testing
*Prove the engine never crashes, never diverges, and always builds the same bytes — under adversarial, property-driven, cross-implementation scrutiny.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.49.0** | Differential test harness | Golden-oracle runner diffing our parse/serialize against pdf.js, qpdf `--json`, Ghostscript `pdfwrite`, and veraPDF over a versioned corpus; normalized AST + rendered-pixel (SSIM) comparators with per-oracle tolerance manifests. | XL |
| **0.49.1** | Property-based invariants | fast-check arbitraries generating well-formed COS object graphs (ISO 32000-2 §7.3) asserting round-trip idempotence `parse∘write∘parse≡parse`, xref↔offset consistency (§7.5.4/§7.5.8), and stream `/Length` invariants. | L |
| **0.49.2** | Coverage-guided fuzz corpus | libFuzzer/AFL++-style harness over the parser via `wasm` + native bindings, seeded from PDFBox/qpdf/pdfium adversarial suites; minimized corpus checked in, branch-coverage tracked against §7.5 file-structure grammar. | M |
| **0.49.3** | CI fuzz job + crash triage | Nightly OSS-Fuzz-style GitHub Actions matrix (short fuzz budget per PR, long nightly), ASan/UBSan on native shims, automatic crash dedup by stack hash and corpus-entry bisection to first-failing commit. | L |
| **0.49.4** | Crash-free parsing guarantee | Total-function parser contract: every byte sequence yields `Result<Doc, RecoverableError>` never an unhandled throw; recursion-depth/allocation guards against billion-laughs, deep `/Kids` trees, and cyclic indirect refs (§7.3.10). | M |
| **0.49.5** | Malformed/adversarial recovery | Reconstruct broken xref by full-file object scan (§7.5.4 recovery), repair off-by-N offsets, truncated/overlapping streams, salvage missing `startxref`/`%%EOF`, mirroring qpdf `--check`/pdfium recovery semantics; fidelity-scored vs oracles. | L |
| **0.49.6** | Regression-snapshot corpus | Deterministic byte-snapshot suite over a curated real-world doc set; content-addressed (BLAKE3) snapshots, intentional-vs-regression diff gate in CI, and a `--update-snapshots` workflow with reviewer sign-off. | M |
| **0.49.7** | Reproducible builds | Bit-identical artifacts: pinned `SOURCE_DATE_EPOCH`, sorted/zeroed zip metadata in WASM+npm tarballs, deterministic `/ID` & XMP timestamps in emitted PDFs, dual-runner build-equivalence check in CI. | L |
| **0.49.8** | Supply-chain attestation | SLSA L3 provenance + Sigstore/cosign keyless signing of npm + WASM artifacts, CycloneDX SBOM, `npm pkg` provenance, and verification gate (`slsa-verifier`) blocking release on attestation mismatch. | L |
| **0.49.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 0.50.x — 1.0 Readiness: API Freeze & Migration
*Curate ~600 ad-hoc exports into one intentional, frozen, tool-gated public surface — the last gate before 1.0.0.*

| Version | Title | Detail | Effort |
|---|---|---|---|
| **0.50.0** | Public-API entry-point consolidation | Collapse ~600 deep-path exports into a single rolled-up `index.ts` barrel + curated subpath `exports` map (Node conditional exports, `"types"` first); annotate every symbol `@public`/`@beta`/`@internal` per TSDoc spec; strip `@internal` from emitted `.d.ts` via API-Extractor rollup. | XL |
| **0.50.1** | Deprecation purge | Delete all `@deprecated` 0.x shims (legacy sync `embedPng`, `isNaN`-era helpers, pre-WeakMap stores); enforce zero `@deprecated` in public rollup via lint gate; record removals in MIGRATION.md keyed to last-supported version. | L |
| **0.50.2** | API-report gating in CI | `@microsoft/api-extractor` generates `etc/modern-pdf-lib.api.md`; CI fails on uncommitted report diff (`--local`/`--ci`); PR bot surfaces additions/removals/breaking changes as the canonical reviewable API contract. | M |
| **0.50.3** | Type-level contract tests | `expect-type`/`tsd` assertions over every public signature + `tsc --noEmit` against the `.d.cts`/`.d.mts` rollups under matrix `tsconfig` (`strict`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: bundler|node16`). | L |
| **0.50.4** | Semver-lint & API diff gating | Wire `@arethetypeswrong/cli` (ATTW) + `api-extractor` diff into release flow; classify each PR diff patch/minor/major; block disallowed breaks on `0.50.x→1.0` track; verify `package.json` `exports`/`types` resolve across all conditions. | M |
| **0.50.5** | Codemods & automated migration | Ship `jscodeshift`/`ts-morph` codemods for renamed symbols + moved import paths (`npx modern-pdf-lib-codemod v0-to-v1`); AST-rewrite deep imports to curated subpaths; idempotent, dry-run, and snapshot-tested. | L |
| **0.50.6** | Exhaustive docs & example coverage | `eslint-plugin-jsdoc` requires TSDoc on 100% of `@public`; doc-lint gate fails on undocumented exports; every public entry gets a runnable, type-checked example (`twoslash`) executed in CI to prevent doc drift. | M |
| **0.50.7** | Supported-runtime matrix CI | Conformance suite across Node ≥25.7 LTS line, Deno, Bun, CF-Workers (`workerd`), and browser (Playwright); publish a support-tier matrix; `engines`/`exports` `"worker"`/`"deno"`/`"browser"` conditions verified against real runtimes. | L |
| **0.50.8** | Security audit & supply-chain hardening | `npm audit`/`osv-scanner` zero-known-vuln gate; provenance via npm `--provenance` (SLSA/sigstore attestation); SBOM (CycloneDX); `socket`/`provenance`-gated single `fflate` dep; reproducible build + signed git tags. | L |
| **0.50.9** | Stabilization | Edge-cases, fuzzing, performance, tests, docs, benchmarks before rolling to the next minor. | M |

---

## 1.0.0 — Stable
**The milestone.** Declared once the full `0.28.x → 0.50.x` arc above ships — feature work (`0.28`–`0.49`) then the `0.50.x` API-freeze gate:
- **ISO 32000-2 (PDF 2.0) feature-complete** across create / read / render / sign / validate — including the §13.6 3D & rich-media stack, §8.8 geospatial/measurement, §12.5 full annotation suite, dynamic forms/XFA migration, and the prepress/print-production path.
- **Frozen public API** with semver guarantees; the export surface curated and gated by API-extractor + `expect-type` (`0.50.x`); all deprecations from the 0.x line removed with codemods.
- **Conformance**: PDF/A-4, PDF/UA-2, PDF/X-6, Factur-X/ZUGFeRD writers + validators green against veraPDF; differential-tested vs pdf.js / qpdf / Ghostscript.
- **Performance**: documented wins vs pdf-lib across the full benchmark matrix; streaming, worker-parallel, and edge/serverless paths stable.
- **Reliability**: property-based + fuzzing corpus in CI, crash-free parsing of adversarial input, reproducible builds with supply-chain attestation.
- **LTS line** begins; published support/versioning policy and supported-runtime matrix (Node / Deno / Bun / CF Workers / browsers).
