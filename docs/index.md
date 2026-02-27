---
layout: home

hero:
  name: Modern PDF
  text: WASM-Accelerated PDF Creation
  tagline: A modern, ESM-only PDF creation engine that runs in every JavaScript runtime — Node, Deno, Bun, Cloudflare Workers, and browsers.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/user/modern-pdf

features:
  - icon: 🌐
    title: Universal Runtime
    details: Runs natively in Node 22+, Deno, Bun, Cloudflare Workers, and all modern browsers. One package, zero platform-specific forks.
  - icon: ⚡
    title: WASM-Accelerated
    details: Optional WebAssembly modules for compression, PNG decoding, font parsing, and text shaping — up to 10x faster than pure-JS equivalents.
  - icon: 🔄
    title: Streaming Output
    details: Generate PDFs as a ReadableStream for low-memory server workloads. Stream directly to HTTP responses or file handles without buffering the entire document.
  - icon: 🌲
    title: Tree-Shakable
    details: ESM-only with no side effects. Import only what you need and let your bundler eliminate the rest. The core bundle starts under 20 KB gzipped.
  - icon: 🔷
    title: TypeScript-First
    details: Written in TypeScript 6.0 with strict types, declaration maps, and full IntelliSense support. Every API surface is precisely typed.
  - icon: 📄
    title: PDF/A Support
    details: Generate archival-grade PDF/A-2b documents for long-term preservation, regulatory compliance, and accessibility requirements.
---
