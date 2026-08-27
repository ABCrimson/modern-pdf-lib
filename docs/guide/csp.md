---
title: Content Security Policy
---

# Content Security Policy (CSP)

modern-pdf-lib is designed to work in environments with strict Content Security Policies. This guide covers the minimum CSP directives needed for each feature.

## Minimum CSP Requirements

### Core PDF Generation (No WASM)

The core library works with a minimal CSP:

```
Content-Security-Policy: default-src 'self'
```

No special directives are needed for creating PDFs, adding text, drawing shapes, or embedding fonts/images when using the pure-JS fallbacks.

### With WASM Acceleration

WASM modules require the `wasm-unsafe-eval` directive:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'
```

> [!NOTE]
> `wasm-unsafe-eval` is a narrowly-scoped directive that only allows WebAssembly compilation. It does **not** allow JavaScript `eval()`. It is supported in Chrome 97+, Firefox 102+, and Safari 16+.

### With Web Workers

If you use `PdfWorker` for off-main-thread PDF generation with inline workers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' blob:; worker-src blob:
```

For custom worker URLs (recommended for strict CSP):

```
Content-Security-Policy: default-src 'self'; worker-src 'self'
```

### With CDN Loading

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://unpkg.com
```

## CSP-Safe WASM Loading

When `wasm-unsafe-eval` is not available, WASM instantiation fails and the library falls through to its pure-JavaScript implementation — compression, for example, drops from libdeflate to fflate and produces identical output. You can also disable WASM up front, which avoids the failed attempt entirely:

```typescript
import { configureWasmLoader } from 'modern-pdf-lib';

// Force pure-JS mode (no WASM needed)
configureWasmLoader({ disableWasm: true });
```

> [!TIP]
> `disableWasm` is the deterministic choice for a locked-down deployment. Rather than attempting a WASM instantiation that the CSP will reject and then recovering, the loader skips WASM entirely and the pure-JS paths run from the first call. Output is byte-identical either way.

## Strict CSP Checklist

| Feature | Required Directive | Fallback Available |
|---|---|---|
| Core PDF generation | `default-src 'self'` | N/A (always works) |
| WASM acceleration | `script-src 'wasm-unsafe-eval'` | Yes -- pure JS |
| Inline Web Workers | `worker-src blob:` | Yes -- custom worker URL |
| CDN scripts | `script-src https://cdn...` | Yes -- self-hosted |
| Data URL previews | `frame-src blob:` | Yes -- download only |

## Testing Your CSP

Use the browser DevTools console to check for CSP violations:

```javascript
document.addEventListener('securitypolicyviolation', (e) => {
  console.warn('CSP violation:', e.violatedDirective, e.blockedURI);
});
```

## Framework-Specific CSP

### Next.js

In `next.config.js`:

```javascript
const cspHeader = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:";

module.exports = {
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
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:"
      }
    }
  }
});
```
