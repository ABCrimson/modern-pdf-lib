# Roadmap Gap Analysis — planned vs. already-implemented

> Evidence-based audit (2026-06-25) of every `0.28`–`0.40` roadmap item against the **actual source tree**.
> The original `ROADMAP.md` was generated from a capability inventory that **understated** the codebase;
> this document is the corrected, ground-truth work list.
>
> **Totals: 25 exist · 45 partial · 60 gap** (out of 130).
>
> **✅ Built since this audit (27 gaps, TDD-verified, all integrated + green):**
> `0.28.3` paragraph-reconstruct · `0.28.6` table-extract · `0.28.7` search ·
> `0.30.0` DParts · `0.30.4` Namespaces · `0.30.5` Requirements · `0.30.9` PieceInfo ·
> `0.32.1/.2` PDF/A-4 · `0.32.4` PDF/X-6 · `0.32.5` PDF/VT · `0.32.7` validation/SARIF ·
> `0.33.2` Factur-X/ZUGFeRD · `0.33.4` XRechnung/Order-X · `0.33.7` Collections ·
> `0.34.4` external-signer · `0.34.6` DocTimeStamp ·
> `0.36.3` WOFF · `0.36.7` font-fallback ·
> `0.37.0` PDF-functions · `0.37.1` CIE-color · `0.37.3` function-shading ·
> `0.38.7` halftones · `0.39.0` worker-pool · `0.39.6` Range-fetch ·
> `0.40.0` VDOM-to-PDF · `0.40.4` Markdown-to-PDF · `0.40.7` error-DX. See CHANGELOG.
> Legend: ✅ exists · 🟡 partial (building blocks present, needs completion) · 🔴 gap (net-new).
> **⚙️ = needs the Rust `wasm32` toolchain** (not available in this environment).

## 0.28 — Reading & Extraction
✅ .0 content-stream parser · 🟡 .1 positioned **glyph** extraction (runs only) · ✅ .2 ToUnicode/CID · 🟡 .3 word/para reconstruction · ✅ .4 StructTree extraction · ✅ .5 artifact filter · 🔴 .6 table→CSV/JSON · 🔴 .7 in-page search+hit-rects · ✅ .8 annotation/link extraction · ✅ .9 xref repair

## 0.29 — Rendering & Rasterization (largest gap)
🔴 .0 content interpreter · 🔴⚙️ .1 WASM rasterizer · 🔴 .2 canvas adapter · 🟡 .3 thumbnails/Thumb · 🟡 .4 image-extract SMask compositing · 🔴 .5 font extract→TTF/OTF · 🔴 .6 SSIM diff · 🔴 .7 OCR hook · 🔴 .8 true content-removal redaction · 🔴 .9 tiling/cache

## 0.30 — PDF 2.0 Core
🔴 .0 DParts · ✅ .1 AF doc/page · ✅ .2 AF annot/object · 🟡 .3 page/stream output intents · 🔴 .4 Namespaces · 🔴 .5 /Requirements · 🟡 .6 unencrypted-wrapper · ✅ .7 luminosity/alpha SMask · 🟡 .8 image SMask+black-point · 🔴 .9 PieceInfo

## 0.31 — Tagged PDF & Accessibility
✅ .0 structure authoring · 🟡 .1 standard-type tagging · 🔴 .2 heading/list helpers · 🟡 .3 table tagging · ✅ .4 Alt/ActualText · 🟡 .5 Lang spans · 🔴 .6 namespace/role-map · 🟡 .7 PDF/UA-2 conformance · 🟡 .8 Matterhorn checker · 🟡 .9 stabilization

## 0.32 — Next-Gen Standards
✅ .0 output-intent mgr · 🔴 .1 PDF/A-4 · 🔴 .2 A-4 XMP ext · 🔴 .3 A-4e/4f · 🔴 .4 PDF/X-6 · 🔴 .5 PDF/VT · 🔴 .6 WTPDF+PDF/R · 🔴 .7 SARIF report · 🔴 .8 profile up/downgrade · 🟡 .9 stabilization

## 0.33 — E-Invoicing & Assembly
✅ .0 PDF/A-3 core · 🟡 .1 embedded-file mgr · 🔴 .2 Factur-X/ZUGFeRD XML · 🔴 .3 hybrid assembler · 🔴 .4 XRechnung/Order-X · 🔴 .5 XML validation · 🔴 .6 ZUGFeRD reader · 🔴 .7 Portfolios/Collections · 🟡 .8 cover-sheet/batch · 🔴 .9 deterministic output

## 0.34 — Advanced Signatures (PAdES)
✅ .0 B-B · 🟡 .1 CAdES signed attrs · 🟡 .2 B-T timestamp · 🟡 .3 PSS/EdDSA/det-ECDSA · 🔴 .4 HSM/KMS signer · ✅ .5 DSS+VRI (B-LT) · 🔴 .6 DocTimeStamp · 🟡 .7 B-LTA renewal · 🟡 .8 trust-path hardening · 🟡 .9 appearance templating

## 0.35 — Security & Sanitization
🔴 .0 public-key encryption · 🔴 .1 AES-GCM · ✅ .2 permission bits · ✅ .3 KDF R6 · ✅ .4 threat-sanitizer · 🟡 .5 attachment purge · 🟡 .6 hidden-data scrubber · 🟡 .7 redaction verifier · ✅ .8 byte-range analyzer · 🟡 .9 tamper report

## 0.36 — Fonts, Text & i18n
🟡 .0 Bidi UAX#9 · ✅ .1 Arabic/Indic shaping · 🔴 .2 OpenType feature toggles · 🔴 .3 WOFF/WOFF2 input · 🔴 .4 variable fonts · 🔴 .5 color fonts COLR/CPAL · 🟡 .6 vertical CJK · 🔴 .7 fallback chains · 🟡 .8 Knuth-Plass/hyphenation · 🟡 .9 stabilization

## 0.37 — Graphics & Color
🟡 .0 PDF functions 0/2/3/4 · 🔴 .1 Cal/Lab color · 🟡 .2 ICC v4 engine · 🔴 .3 function shading · 🔴 .4 mesh shadings · ✅ .5 tiling patterns · 🟡 .6 blend modes · ✅ .7 transparency groups · 🟡 .8 overprint · 🔴 .9 gradient-mesh helpers

## 0.38 — Imaging & Media
🔴 .0 codec core · 🔴⚙️ .1 AVIF · 🔴⚙️ .2 JPEG XL · 🔴⚙️ .3 HEIC · ✅ .4 ICC-tagged images · 🟡 .5 JPEG→JXL optimizer · 🟡 .6 down-sampling preflight · 🔴 .7 halftones · 🟡 .8 advanced SVG+charts · 🔴 .9 stabilization

## 0.39 — Performance & Concurrency
🔴 .0 worker-pool · 🔴 .1 SharedArrayBuffer · 🔴⚙️ .2 SIMD WASM · 🟡 .3 lazy parse cache · 🟡 .4 memory cap/LRU · 🟡 .5 partial parse · 🔴 .6 HTTP Range fetch · ✅ .7 streaming writer · ✅ .8 xref/object streams · 🟡 .9 hardening

## 0.40 — Developer Experience
🔴 .0 VDOM core · 🔴 .1 JSX-to-PDF · 🔴 .2 React/Vue/Svelte · 🟡 .3 template engine · 🔴 .4 Markdown-to-PDF · 🟡 .5 schema forms · 🔴 .6 server adapters · 🟡 .7 error DX · 🟡 .8 CLI/REPL/registry · 🔴 .9 bundle audit

---

## Execution priority (corrected)
1. **Pure-TS gaps buildable now** (no WASM): `0.28.6` table-extract, `0.28.7` search, `0.30.0/.4/.5/.9`, `0.32.x` standards, `0.33.x` e-invoicing, `0.34.6` DocTimeStamp, `0.35.0/.1` crypto, `0.40.x` DX. — **build these TDD-first.**
2. **Complete the 45 partials** (building blocks exist — finish the missing piece).
3. **⚙️ WASM-dependent** (`0.29.1` rasterizer, `0.38.1-.3` codecs, `0.39.2` SIMD): need the Rust `wasm32` toolchain; blocked in this environment, deferred to a toolchain-equipped build.
