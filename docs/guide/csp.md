---
title: Content Security Policy
---

# Content Security Policy (CSP)

modern-pdf-lib is designed to work in environments with strict Content Security Policies. This guide covers the minimum CSP directives needed for each feature.

## Minimum CSP Requirements

### Core PDF Generation

The core library works with a minimal CSP:

```
Content-Security-Policy: default-src 'self'
```

No special directives are needed for creating PDFs, adding text, drawing shapes, or embedding fonts/images.

### WebAssembly

No WebAssembly module loads, so the library does not need `wasm-unsafe-eval`. If your own code compiles WebAssembly, for example from the files under `modern-pdf-lib/wasm/*`, that code needs the `wasm-unsafe-eval` source expression:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'
```

> [!NOTE]
> `wasm-unsafe-eval` is a narrowly-scoped source expression that only allows WebAssembly compilation. It does **not** allow JavaScript `eval()`.

### With Web Workers

`PdfWorker` sends the task function to the worker as a string, and the worker evaluates it with `new Function`. The worker's policy therefore must include `script-src 'unsafe-eval'`. Pass a `workerUrl` (see [Browser Integration](./browser.md#web-workers)); a worker loaded from a URL gets its policy from its own response headers, for example:

```
Content-Security-Policy: script-src 'self' 'unsafe-eval'
```

The page itself only needs to allow the worker script:

```
Content-Security-Policy: default-src 'self'; worker-src 'self'
```

Without `workerUrl`, `PdfWorker` builds a worker from a `blob:` URL that inherits the page policy and cannot resolve its `modern-pdf-lib` import.

### With CDN Loading

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://unpkg.com
```

## CSP-Safe WASM Loading

Disable the WASM loader up front so that it refuses every module and makes no `.wasm` request or compile attempt:

```typescript
import { configureWasmLoader } from 'modern-pdf-lib';

// Force pure-JS mode (no WASM needed)
configureWasmLoader({ disableWasm: true });
```

> [!TIP]
> `disableWasm` is the deterministic choice for a locked-down deployment: unless you also pass `moduleBytes`, no `.wasm` request or compile attempt is made, and the pure-JS paths run from the first call.

## Strict CSP Checklist

<!-- capabilities:begin guide-csp-checklist -->

| Feature | Required Directive | Fallback Available |
|---|---|---|
| Core PDF generation | `default-src 'self'` | N/A (always works) |
| WebAssembly compiled by your own code | `script-src 'wasm-unsafe-eval'` | N/A -- not loaded by the library |
| `PdfWorker` | `worker-src 'self'` (page) + `script-src 'unsafe-eval'` (worker) | Yes -- generate on the main thread |
| CDN scripts | `script-src https://cdn...` | Yes -- self-hosted |
| Data URL previews | `frame-src blob:` | Yes -- download only |

<!-- capabilities:end -->

## Testing Your CSP

Use the browser DevTools console to check for CSP violations:

```javascript
document.addEventListener('securitypolicyviolation', (e) => {
  console.warn('CSP violation:', e.violatedDirective, e.blockedURI);
});
```

## Framework-Specific CSP

### Next.js

In `next.config.mjs`:

```javascript
const cspHeader = "default-src 'self'; worker-src 'self'";

export default {
  async headers() {
    return [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: cspHeader }] }];
  },
};
```

### Nuxt

In `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': "default-src 'self'; worker-src 'self'"
      }
    }
  }
});
```

Next.js and Nuxt inject inline scripts that `default-src 'self'` blocks; add a nonce or hash policy for them in your framework's CSP configuration.
