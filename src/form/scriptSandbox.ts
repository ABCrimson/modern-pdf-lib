/**
 * @module form/scriptSandbox
 *
 * Sandboxed execution environment for PDF form JavaScript.
 *
 * PDF forms can contain JavaScript for calculations, validation, and
 * formatting (a subset of the Acrobat JavaScript API). This module
 * provides a secure sandbox that executes those scripts without
 * granting access to the host environment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a sandbox. */
export interface SandboxOptions {
  /** Maximum execution time in milliseconds (default: 1000). */
  timeout?: number | undefined;
  /** Maximum memory usage in bytes (advisory, default: 10 MB). */
  maxMemory?: number | undefined;
  /** Additional global names to allow in the sandbox scope. */
  allowedGlobals?: string[] | undefined;
}

/** Result of executing a script in the sandbox. */
export interface SandboxResult {
  /** Whether the script executed without errors. */
  success: boolean;
  /** The return value of the script expression (if any). */
  returnValue?: unknown;
  /** Error message if `success` is false. */
  error?: string;
  /** Execution time in milliseconds. */
  executionTimeMs: number;
}

// ---------------------------------------------------------------------------
// Dangerous pattern stripping
// ---------------------------------------------------------------------------

const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /\bimport\s*\(/g,
  /\brequire\s*\(/g,
  /\bfetch\s*\(/g,
  /\beval\s*\(/g,
  /\bFunction\s*\(/g,
  /\b__proto__\b/g,
  /\bconstructor\s*\[/g,
  /\.constructor\b/g,
  /\bprototype\b/g,
];

function sanitizeScript(script: string): string {
  let s = script;
  for (const p of DANGEROUS_PATTERNS) {
    p.lastIndex = 0;
    s = s.replace(p, '/* blocked */');
  }
  return s;
}

// ---------------------------------------------------------------------------
// Reserved words — cannot be used as `new Function(...)` parameter names
// ---------------------------------------------------------------------------

const RESERVED = new Set([
  'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof',
  'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'class', 'const', 'enum', 'export', 'extends',
  'import', 'super', 'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static', 'yield', 'null', 'true', 'false',
  'eval', 'arguments', 'undefined', 'NaN', 'Infinity',
]);

// ---------------------------------------------------------------------------
// Field proxy
// ---------------------------------------------------------------------------

interface FieldProxy {
  readonly name: string;
  value: string;
  valueAsString: string;
}

// ---------------------------------------------------------------------------
// FormScriptSandbox
// ---------------------------------------------------------------------------

/**
 * A sandboxed execution environment for PDF form JavaScript.
 * Create via {@link createSandbox}.
 */
export class FormScriptSandbox {
  private readonly timeout: number;
  private readonly allowedGlobals: string[];
  private fieldValues: Map<string, string>;
  private builtins: Map<string, unknown>;
  private destroyed = false;

  constructor(options?: SandboxOptions) {
    this.timeout = options?.timeout ?? 1000;
    this.allowedGlobals = options?.allowedGlobals ? [...options.allowedGlobals] : [];
    this.fieldValues = new Map();
    this.builtins = new Map();
    this.registerDefaultBuiltins();
  }

  /** Execute a script in the sandbox. */
  execute(script: string): SandboxResult {
    if (this.destroyed) {
      return { success: false, error: 'Sandbox has been destroyed', executionTimeMs: 0 };
    }
    const t0 = performance.now();
    try {
      const sanitized = sanitizeScript(script);
      const scope = this.buildScope();

      // Filter out reserved words from scope keys
      const entries = Object.entries(scope).filter(
        ([k]) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) && !RESERVED.has(k),
      );
      const names = entries.map(([k]) => k);
      const vals = entries.map(([, v]) => v);

      // Build function — expression first, then statement fallback.
      // Prepend "use strict" for security (blocks arguments.callee, etc.)
      const strict = '"use strict";\n';
      let fn: (...a: unknown[]) => unknown;
      if (/\breturn\b/.test(sanitized)) {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        fn = new Function(...names, `${strict}${sanitized}`) as (...a: unknown[]) => unknown;
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          fn = new Function(...names, `${strict}return (\n${sanitized}\n);`) as (...a: unknown[]) => unknown;
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          fn = new Function(...names, `${strict}${sanitized}`) as (...a: unknown[]) => unknown;
        }
      }

      let ret: unknown;
      let timedOut = false;
      const tid = setTimeout(() => { timedOut = true; }, this.timeout);
      try { ret = fn(...vals); } finally { clearTimeout(tid); }

      if (timedOut) {
        return { success: false, error: `Script exceeded ${this.timeout}ms timeout`, executionTimeMs: performance.now() - t0 };
      }
      return { success: true, returnValue: ret, executionTimeMs: performance.now() - t0 };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), executionTimeMs: performance.now() - t0 };
    }
  }

  /** Set field values available to scripts. */
  setFieldValues(values: Map<string, string>): void {
    if (!this.destroyed) this.fieldValues = new Map(values);
  }

  /** Get field values (possibly modified by scripts). */
  getFieldValues(): Map<string, string> {
    return new Map(this.fieldValues);
  }

  /** Register a built-in function. */
  registerBuiltin(name: string, fn: (...args: unknown[]) => unknown): void {
    if (!this.destroyed) this.builtins.set(name, fn);
  }

  /** Reset state (field values and custom builtins). */
  reset(): void {
    if (this.destroyed) return;
    this.fieldValues = new Map();
    this.builtins = new Map();
    this.registerDefaultBuiltins();
  }

  /** Destroy the sandbox. */
  destroy(): void {
    this.destroyed = true;
    this.fieldValues.clear();
    this.builtins.clear();
  }

  // -----------------------------------------------------------------------

  private registerDefaultBuiltins(): void {
    this.builtins.set('AFSimple_Calculate', (op: unknown, fields: unknown) => {
      if (typeof op !== 'string' || !Array.isArray(fields)) return 0;
      const nums = fields.map((f: unknown) => {
        const raw = this.fieldValues.get(typeof f === 'string' ? f : String(f)) ?? '0';
        return parseFloat(raw) || 0;
      });
      switch (op.toUpperCase()) {
        case 'SUM': return nums.reduce((a, b) => a + b, 0);
        case 'AVG': return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case 'PRD': return nums.reduce((a, b) => a * b, 1);
        case 'MIN': return nums.length > 0 ? Math.min(...nums) : 0;
        case 'MAX': return nums.length > 0 ? Math.max(...nums) : 0;
        default: return 0;
      }
    });
    /* eslint-disable @typescript-eslint/no-empty-function */
    this.builtins.set('console', { println() {}, show() {}, clear() {} });
    this.builtins.set('app', { alert() {}, beep() {}, response: () => '' });
    this.builtins.set('event', { value: '', target: { name: '' }, targetName: '', rc: true });
    /* eslint-enable @typescript-eslint/no-empty-function */
  }

  private buildScope(): Record<string, unknown> {
    const fv = this.fieldValues;
    const getField = (name: unknown): FieldProxy | null => {
      const n = String(name);
      if (!fv.has(n)) return null;
      return {
        get name() { return n; },
        get value() { return fv.get(n) ?? ''; },
        set value(v: string) { fv.set(n, String(v)); },
        get valueAsString() { return fv.get(n) ?? ''; },
        set valueAsString(v: string) { fv.set(n, String(v)); },
      };
    };

    const scope: Record<string, unknown> = {
      Math,
      parseInt, parseFloat, String, Number, Boolean, Array,
      JSON: Object.freeze({ parse: JSON.parse, stringify: JSON.stringify }),
      isNaN, isFinite, Date, RegExp,
      getField,
      globalThis: undefined, window: undefined, self: undefined,
      global: undefined, process: undefined, document: undefined,
      XMLHttpRequest: undefined, WebSocket: undefined,
      Worker: undefined, SharedWorker: undefined,
      Proxy: undefined, Reflect: undefined,
    };

    for (const [k, v] of this.builtins) scope[k] = v;
    for (const g of this.allowedGlobals) {
      if (g in globalThis && !(g in scope)) {
        scope[g] = (globalThis as Record<string, unknown>)[g];
      }
    }
    return scope;
  }
}

/**
 * Create a new sandboxed execution environment for PDF form scripts.
 */
export function createSandbox(options?: SandboxOptions): FormScriptSandbox {
  return new FormScriptSandbox(options);
}
