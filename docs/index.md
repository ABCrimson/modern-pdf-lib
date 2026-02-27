---
layout: home

hero:
  name: Modern PDF
  text: WASM-Accelerated PDF Engine
  tagline: Create, parse, merge, and manipulate PDFs in every JavaScript runtime. ESM-only, zero dependencies, TypeScript-first.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/ABCrimson/modern-pdf-lib

features:
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#g-universal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g-universal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
    title: Universal Runtime
    details: Runs natively in Node.js 25+, Deno, Bun, Cloudflare Workers, and all modern browsers. One package, zero platform forks.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#g-wasm)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g-wasm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    title: WASM-Accelerated
    details: Optional WebAssembly modules for compression, image decoding, and font shaping — with pure-JS fallbacks that still outperform the competition.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#g-stream)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g-stream" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M12 12h.01"/><path d="M17 12a5 5 0 1 0-5 5"/></svg>
    title: Streaming Output
    details: Generate PDFs as a ReadableStream for low-memory server workloads. Stream directly to HTTP responses without buffering entire documents.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#g-tree)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g-tree" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><rect x="2" y="6" width="20" height="12" rx="2"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/></svg>
    title: Tree-Shakable ESM
    details: Pure ESM with zero side effects. Import only what you need — core bundle starts under 20 KB gzipped. No CommonJS baggage.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#g-ts)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g-ts" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    title: TypeScript-First
    details: Written in TypeScript 6.0 with strict types, declaration maps, and full IntelliSense. Every API surface is precisely typed.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#g-pdfa)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g-pdfa" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
    title: PDF/A Compliance
    details: Generate archival-grade PDF/A-1b through PDF/A-3u documents for long-term preservation, regulatory compliance, and accessibility.
---

<div class="benchmark-section">
  <h2>Benchmarked Against pdf-lib</h2>
  <p class="subtitle">
    Head-to-head across 30 operations. Measured with Vitest bench on Node.js 25.7.
  </p>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-number">27/30</div>
      <div class="stat-label">Benchmarks Won</div>
      <div class="stat-detail">vs pdf-lib v1.17.1</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">39x</div>
      <div class="stat-label">Faster Creation</div>
      <div class="stat-detail">Empty document + page</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">57x</div>
      <div class="stat-label">Faster Parsing</div>
      <div class="stat-detail">100-page PDF load</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">25x</div>
      <div class="stat-label">Faster Text</div>
      <div class="stat-detail">1,000x drawText calls</div>
    </div>
  </div>
</div>

<div class="runtime-section">
  <h2>Runs Everywhere</h2>
  <p class="subtitle">One package. Every JavaScript runtime. Zero platform forks.</p>
  <div class="runtime-badges">
    <span class="runtime-badge"><span class="badge-icon">&#9679;</span> Node.js 25+</span>
    <span class="runtime-badge"><span class="badge-icon">&#9679;</span> Deno</span>
    <span class="runtime-badge"><span class="badge-icon">&#9679;</span> Bun</span>
    <span class="runtime-badge"><span class="badge-icon">&#9679;</span> Cloudflare Workers</span>
    <span class="runtime-badge"><span class="badge-icon">&#9679;</span> Browsers</span>
  </div>
</div>
