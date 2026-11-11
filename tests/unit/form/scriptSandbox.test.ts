/**
 * Tests for FormScriptSandbox. Since 0.40.5 execute() throws
 * ScriptExecutionDisabledError (evaluation disabled); the state methods still
 * work. Escape and endless-loop cases live in tests/adversarial/formScript.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { ScriptExecutionDisabledError } from '../../../src/errors.js';
import { createSandbox, FormScriptSandbox } from '../../../src/form/scriptSandbox.js';

// ---------------------------------------------------------------------------
// Execution is disabled
// ---------------------------------------------------------------------------

const SCRIPTS: readonly string[] = [
  'return 2 + 3;',
  'return "hello" + " " + "world";',
  'var x = 10; var y = 20; return x + y;',
  'return Math.max(1, 2, 3);',
  'return parseInt("42");',
  'return isNaN(NaN);',
  'return {{{;',
  'throw new Error("test error");',
  'var sum = 0; for (var i = 0; i < 1000; i++) sum += i; return sum;',
  'getField("total").value = "100";',
  'return getField("nonexistent");',
  'return getField("myField").name;',
  'return getField("f1").valueAsString;',
  'return AFSimple_Calculate("SUM", ["a", "b", "c"]);',
  'return AFSimple_Calculate("AVG", ["x", "y"]);',
  'return myFunc(3, 7);',
  'app.alert("hello");',
  'return eval("1+1");',
  'return Function("return 1")();',
  'return typeof globalThis;',
  'return typeof window;',
  'return typeof process;',
  'return import("fs");',
  'var fs = require("fs");',
  'return fetch("https://evil.com");',
  'var obj = {}; return obj.__proto__;',
  'return ""["con" + "structor"]',
  'var x = {}.constructor; return typeof x;',
  'return String.prototype;',
  'return typeof WebSocket;',
  'return typeof Worker;',
  'return typeof Proxy;',
  'return typeof Reflect;',
  'return arguments.callee;',
  'return (function() { return typeof this; })();',
  `
      var t1 = parseFloat(getField("item1_qty").value) * parseFloat(getField("item1_price").value);
      getField("total").value = String(t1);
    `,
  `
      var country = getField("country").value;
      if (country === "US") { getField("state_label").value = "State"; }
    `,
  `
      event.value = String(parseFloat(getField("qty").value) * parseFloat(getField("price").value));
      return event.value;
    `,
  'return AFSimple_Calculate("SUM", ["line1", "line2", "line3"]);',
];

describe('FormScriptSandbox — execution is disabled', () => {
  it.each(SCRIPTS)('execute throws ScriptExecutionDisabledError for %s', (script) => {
    expect(() => createSandbox().execute(script)).toThrow(ScriptExecutionDisabledError);
  });

  it('execute throws after destroy', () => {
    const sandbox = createSandbox();
    sandbox.destroy();
    expect(() => sandbox.execute('return 1 + 1;')).toThrow(ScriptExecutionDisabledError);
  });
});

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — construction', () => {
  it.each([
    ['no options', () => createSandbox()],
    ['timeout', () => createSandbox({ timeout: 50 })],
    ['allowedGlobals', () => createSandbox({ allowedGlobals: ['customGlobal'] })],
    ['constructor with timeout', () => new FormScriptSandbox({ timeout: 500 })],
  ])('%s returns a FormScriptSandbox without throwing', (_name, make) => {
    expect(make()).toBeInstanceOf(FormScriptSandbox);
  });
});

// ---------------------------------------------------------------------------
// State only
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — field values and builtins (state only)', () => {
  it('getFieldValues returns a copy', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['a', '1']]));
    const values = sandbox.getFieldValues();
    values.set('a', '999');
    // Original should be unchanged
    expect(sandbox.getFieldValues().get('a')).toBe('1');
    sandbox.destroy();
  });

  it('reset clears field values', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['x', '42']]));
    expect(() => sandbox.registerBuiltin('custom', () => 'hi')).not.toThrow();

    sandbox.reset();
    expect(sandbox.getFieldValues().size).toBe(0);
    sandbox.destroy();
  });

  it('destroy prevents setFieldValues', () => {
    const sandbox = createSandbox();
    sandbox.destroy();
    sandbox.setFieldValues(new Map([['x', '1']]));
    expect(sandbox.getFieldValues().size).toBe(0);
  });
});
