/**
 * Adversarial tests for form-script evaluation (0.40.5).
 * FormScriptSandbox.execute must throw ScriptExecutionDisabledError before
 * it reads the script, so no escape route and no endless loop can run.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createSandbox, ScriptExecutionDisabledError } from '../../src/index.js';
import { FormScriptSandbox } from '../../src/form/scriptSandbox.js';
import type { SandboxOptions } from '../../src/form/scriptSandbox.js';

const MARKER = '__mpdfFormScriptEscape';

afterEach(() => {
  Reflect.deleteProperty(globalThis, MARKER);
});

describe('form script evaluation is disabled', () => {
  it('the String-constructor probe never reaches globalThis.process', () => {
    const sandbox = createSandbox();
    const script = `String["constructor"]("globalThis.${MARKER} = typeof globalThis.process")()`;
    expect(() => sandbox.execute(script)).toThrow(ScriptExecutionDisabledError);
    expect(Reflect.get(globalThis, MARKER)).toBeUndefined();
  });

  it.each([
    `return String["constructor"]("globalThis.${MARKER} = 1")();`,
    `var k='con'+'structor'; ''[k][k]('globalThis.${MARKER} = 1')();`,
    `var c='constr'+'uctor'; Math.max[c]('globalThis.${MARKER} = 1')();`,
    `[]['constr'+'uctor']['constr'+'uctor']('globalThis.${MARKER} = 1')();`,
    `var f = eval; f('globalThis.${MARKER} = 1');`,
  ])('escape route %s is never evaluated', (script) => {
    const sandbox = createSandbox();
    expect(() => sandbox.execute(script)).toThrow(ScriptExecutionDisabledError);
    expect(Reflect.get(globalThis, MARKER)).toBeUndefined();
  });

  it('an endless loop returns at once because nothing is evaluated', () => {
    const sandbox = createSandbox({ timeout: 10 });
    // Hang guard: while evaluation is live, `while (true) {}` blocks this worker
    // for ever (vitest's timer cannot interrupt synchronous code), so a harmless
    // script must already throw before the loop is attempted.
    expect(() => sandbox.execute('1')).toThrow(ScriptExecutionDisabledError);
    const t0 = performance.now();
    expect(() => sandbox.execute('while (true) {}')).toThrow(ScriptExecutionDisabledError);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it('the error carries name, code and message', () => {
    let caught: unknown;
    try {
      createSandbox().execute('return 1');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ScriptExecutionDisabledError);
    expect(caught).toBeInstanceOf(Error);
    const err = caught as ScriptExecutionDisabledError;
    expect(err.name).toBe('ScriptExecutionDisabledError');
    expect(err.code).toBe('script-execution-disabled');
    expect(err.message).toBe(
      'Form script execution is disabled: FormScriptSandbox.execute() does not evaluate PDF JavaScript.',
    );
  });

  it('execute does not read the script text', () => {
    let read = false;
    const script = {
      toString() {
        read = true;
        return 'return 1';
      },
    } as unknown as string;
    expect(() => new FormScriptSandbox().execute(script)).toThrow(ScriptExecutionDisabledError);
    expect(read).toBe(false);
  });

  it('execute throws on a destroyed sandbox and for every option set', () => {
    const optionSets: Array<SandboxOptions | undefined> = [
      undefined,
      {},
      { timeout: 1 },
      { maxMemory: 1 },
      { allowedGlobals: ['process', 'fetch'] },
    ];
    for (const opts of optionSets) {
      const s = createSandbox(opts);
      expect(() => s.execute('return 1')).toThrow(ScriptExecutionDisabledError);
      s.destroy();
      expect(() => s.execute('return 1')).toThrow(ScriptExecutionDisabledError);
    }
  });

  it('registered builtins and getField writes are never invoked', () => {
    const sandbox = createSandbox();
    let calls = 0;
    sandbox.registerBuiltin('probe', () => {
      calls += 1;
      return 0;
    });
    sandbox.setFieldValues(new Map([['total', '0']]));
    expect(() => sandbox.execute('probe(); getField("total").value = "100";')).toThrow(
      ScriptExecutionDisabledError,
    );
    expect(calls).toBe(0);
    expect(sandbox.getFieldValues().get('total')).toBe('0');
  });

  it('scriptSandbox.ts holds no code-generation sink', () => {
    const src = readFileSync(new URL('../../src/form/scriptSandbox.ts', import.meta.url), 'utf8');
    // Ban the tokens, not only the call shapes: an alias (`const C = Function`),
    // indirect eval, a constructor chain, Reflect.construct, a string timer or an
    // import() of a data: URL or a 'vm' / 'node:vm' import would otherwise pass this guard.
    expect(src).not.toMatch(
      /\bFunction\b|\beval\b|\.\s*constructor\b|\bconstructor\s*['"`\]]|\bReflect\b|\bset(?:Timeout|Interval|Immediate)\b|\bimport\s*\(|\bglobalThis\b|['"`](?:node:)?vm['"`]/,
    );
  });
});
