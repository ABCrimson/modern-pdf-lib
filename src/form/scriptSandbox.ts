/**
 * @module form/scriptSandbox
 *
 * Holder for PDF form script state. Since 0.40.5 no script is evaluated:
 * PDF JavaScript from a document is never compiled or run, and
 * {@link FormScriptSandbox.execute} throws {@link ScriptExecutionDisabledError}.
 * The field values and builtins the class holds are kept for API
 * compatibility.
 */

import { ScriptExecutionDisabledError } from '../errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a sandbox. Every field is accepted and ignored. */
export interface SandboxOptions {
  /** Ignored since 0.40.5 (no script is executed). */
  timeout?: number | undefined;
  /** Ignored since 0.40.5 (no script is executed); it was never enforced. */
  maxMemory?: number | undefined;
  /** Ignored since 0.40.5 (no script is executed). */
  allowedGlobals?: string[] | undefined;
}

/**
 * Kept for type compatibility; since 0.40.5 `execute` throws and never
 * returns one.
 */
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
// FormScriptSandbox
// ---------------------------------------------------------------------------

/**
 * Holds form field values and builtins. Script evaluation is disabled since
 * 0.40.5: `execute` throws {@link ScriptExecutionDisabledError}.
 * Create via {@link createSandbox}.
 */
export class FormScriptSandbox {
  private fieldValues: Map<string, string>;
  private builtins: Map<string, unknown>;
  private destroyed = false;

  constructor(_options?: SandboxOptions) {
    this.fieldValues = new Map();
    this.builtins = new Map();
    this.registerDefaultBuiltins();
  }

  /**
   * Script execution is disabled since 0.40.5: modern-pdf-lib does not
   * evaluate PDF JavaScript. The script text is not read.
   *
   * @throws {ScriptExecutionDisabledError} Always.
   */
  execute(_script: string): SandboxResult {
    throw new ScriptExecutionDisabledError();
  }

  /** Store a copy of the given field values. No script reads them: `execute` throws since 0.40.5. */
  setFieldValues(values: Map<string, string>): void {
    if (!this.destroyed) this.fieldValues = new Map(values);
  }

  /** Get a copy of the stored field values. */
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
        case 'SUM':
          return nums.reduce((a, b) => a + b, 0);
        case 'AVG':
          return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case 'PRD':
          return nums.reduce((a, b) => a * b, 1);
        case 'MIN':
          return nums.length > 0 ? Math.min(...nums) : 0;
        case 'MAX':
          return nums.length > 0 ? Math.max(...nums) : 0;
        default:
          return 0;
      }
    });
    /* eslint-disable @typescript-eslint/no-empty-function */
    this.builtins.set('console', { println() {}, show() {}, clear() {} });
    this.builtins.set('app', { alert() {}, beep() {}, response: () => '' });
    this.builtins.set('event', { value: '', target: { name: '' }, targetName: '', rc: true });
    /* eslint-enable @typescript-eslint/no-empty-function */
  }
}

/**
 * Create a {@link FormScriptSandbox}. Its `execute` throws
 * {@link ScriptExecutionDisabledError} since 0.40.5.
 */
export function createSandbox(options?: SandboxOptions): FormScriptSandbox {
  return new FormScriptSandbox(options);
}
