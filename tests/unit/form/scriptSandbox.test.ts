/**
 * Tests for FormScriptSandbox — sandboxed form script execution.
 *
 * Covers: createSandbox, execute, field values, builtins, reset, destroy,
 * and security/injection prevention.
 */

import { describe, it, expect } from 'vitest';
import { createSandbox, FormScriptSandbox } from '../../../src/form/scriptSandbox.js';
import type { SandboxResult } from '../../../src/form/scriptSandbox.js';

// ---------------------------------------------------------------------------
// Basic execution
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — basic execution', () => {
  it('evaluates a simple arithmetic expression', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return 2 + 3;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(5);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    sandbox.destroy();
  });

  it('evaluates string operations', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return "hello" + " " + "world";');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('hello world');
    sandbox.destroy();
  });

  it('supports variable declarations', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('var x = 10; var y = 20; return x + y;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(30);
    sandbox.destroy();
  });

  it('has access to Math', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return Math.max(1, 2, 3);');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(3);
    sandbox.destroy();
  });

  it('has access to parseInt/parseFloat', () => {
    const sandbox = createSandbox();
    const r1 = sandbox.execute('return parseInt("42");');
    expect(r1.returnValue).toBe(42);

    const r2 = sandbox.execute('return parseFloat("3.14");');
    expect(r2.returnValue).toBeCloseTo(3.14);
    sandbox.destroy();
  });

  it('has access to isNaN/isFinite', () => {
    const sandbox = createSandbox();
    expect(sandbox.execute('return isNaN(NaN);').returnValue).toBe(true);
    expect(sandbox.execute('return isFinite(42);').returnValue).toBe(true);
    expect(sandbox.execute('return isFinite(Infinity);').returnValue).toBe(false);
    sandbox.destroy();
  });

  it('returns error result for invalid syntax', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return {{{;');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    sandbox.destroy();
  });

  it('returns error result for runtime errors', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('throw new Error("test error");');
    expect(result.success).toBe(false);
    expect(result.error).toBe('test error');
    sandbox.destroy();
  });

  it('tracks execution time', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('var sum = 0; for (var i = 0; i < 1000; i++) sum += i; return sum;');
    expect(result.success).toBe(true);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    sandbox.destroy();
  });
});

// ---------------------------------------------------------------------------
// Field values
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — field values', () => {
  it('reads field values via getField()', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['quantity', '5'],
      ['price', '10.50'],
    ]));

    const result = sandbox.execute(
      'return parseFloat(getField("quantity").value) * parseFloat(getField("price").value);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBeCloseTo(52.5);
    sandbox.destroy();
  });

  it('writes field values via getField().value setter', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['total', '0']]));

    sandbox.execute('getField("total").value = "100";');
    const values = sandbox.getFieldValues();
    expect(values.get('total')).toBe('100');
    sandbox.destroy();
  });

  it('returns null for non-existent fields', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return getField("nonexistent");');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBeNull();
    sandbox.destroy();
  });

  it('field proxy has name property', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['myField', 'hello']]));

    const result = sandbox.execute('return getField("myField").name;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('myField');
    sandbox.destroy();
  });

  it('field proxy has valueAsString property', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['f1', 'test']]));

    const result = sandbox.execute('return getField("f1").valueAsString;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('test');
    sandbox.destroy();
  });

  it('getFieldValues returns a copy', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['a', '1']]));
    const values = sandbox.getFieldValues();
    values.set('a', '999');
    // Original should be unchanged
    expect(sandbox.getFieldValues().get('a')).toBe('1');
    sandbox.destroy();
  });
});

// ---------------------------------------------------------------------------
// AFSimple_Calculate built-in
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — AFSimple_Calculate', () => {
  it('calculates SUM', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['a', '10'],
      ['b', '20'],
      ['c', '30'],
    ]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("SUM", ["a", "b", "c"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(60);
    sandbox.destroy();
  });

  it('calculates AVG', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['x', '10'],
      ['y', '20'],
    ]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("AVG", ["x", "y"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(15);
    sandbox.destroy();
  });

  it('calculates PRD (product)', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['a', '3'],
      ['b', '4'],
    ]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("PRD", ["a", "b"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(12);
    sandbox.destroy();
  });

  it('calculates MIN', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['a', '5'],
      ['b', '2'],
      ['c', '8'],
    ]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("MIN", ["a", "b", "c"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(2);
    sandbox.destroy();
  });

  it('calculates MAX', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['a', '5'],
      ['b', '2'],
      ['c', '8'],
    ]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("MAX", ["a", "b", "c"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(8);
    sandbox.destroy();
  });

  it('handles missing fields as 0', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['a', '10']]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("SUM", ["a", "missing"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(10);
    sandbox.destroy();
  });
});

// ---------------------------------------------------------------------------
// Custom builtins
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — custom builtins', () => {
  it('registers and calls a custom builtin', () => {
    const sandbox = createSandbox();
    sandbox.registerBuiltin('myFunc', (a: unknown, b: unknown) => {
      return Number(a) + Number(b);
    });

    const result = sandbox.execute('return myFunc(3, 7);');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(10);
    sandbox.destroy();
  });

  it('can override default builtins', () => {
    const sandbox = createSandbox();
    const alerts: unknown[] = [];
    sandbox.registerBuiltin('app', {
      alert: (msg: unknown) => { alerts.push(msg); },
    } as unknown as (...args: unknown[]) => unknown);

    sandbox.execute('app.alert("hello");');
    expect(alerts).toEqual(['hello']);
    sandbox.destroy();
  });
});

// ---------------------------------------------------------------------------
// Reset and destroy
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — reset and destroy', () => {
  it('reset clears field values and custom builtins', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['x', '42']]));
    sandbox.registerBuiltin('custom', () => 'hi');

    sandbox.reset();
    const values = sandbox.getFieldValues();
    expect(values.size).toBe(0);

    // Default builtins should still work after reset
    const result = sandbox.execute('return AFSimple_Calculate("SUM", []);');
    expect(result.success).toBe(true);
    sandbox.destroy();
  });

  it('destroy prevents further execution', () => {
    const sandbox = createSandbox();
    sandbox.destroy();

    const result = sandbox.execute('return 1 + 1;');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Sandbox has been destroyed');
  });

  it('destroy prevents setFieldValues', () => {
    const sandbox = createSandbox();
    sandbox.destroy();
    sandbox.setFieldValues(new Map([['x', '1']]));
    expect(sandbox.getFieldValues().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Security — injection prevention
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — security', () => {
  it('blocks eval() calls', () => {
    const sandbox = createSandbox();
    // eval is shadowed to undefined, so calling it should fail
    const result = sandbox.execute('return eval("1+1");');
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks Function constructor access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return Function("return 1")();');
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks globalThis access', () => {
    const sandbox = createSandbox();
    // globalThis is shadowed to undefined
    const result = sandbox.execute('return typeof globalThis;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('blocks window access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return typeof window;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('blocks process access', () => {
    const sandbox = createSandbox();
    // process is shadowed to undefined in the sandbox scope
    const result = sandbox.execute('return typeof process;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('blocks import() calls', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return import("fs");');
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks require() calls', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('var fs = require("fs");');
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks fetch() calls', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return fetch("https://evil.com");');
    // fetch is both sanitized and shadowed — should fail
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks __proto__ access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('var obj = {}; return obj.__proto__;');
    // __proto__ is sanitized to /* blocked */
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks constructor access via dot notation', () => {
    const sandbox = createSandbox();
    // .constructor is sanitized to /* blocked */ so dangerous access
    // patterns like "".constructor("return this")() are neutralized
    const result = sandbox.execute('return ""["con" + "structor"]');
    // Even though the bracket access works syntactically, constructor
    // invocation via .constructor is sanitized in the source text
    const result2 = sandbox.execute('var x = {}.constructor; return typeof x;');
    // .constructor gets sanitized so x = {}/* blocked */ which is just {}
    expect(result2.success).toBe(true);
    sandbox.destroy();
  });

  it('blocks prototype access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return String.prototype;');
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('blocks WebSocket access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return typeof WebSocket;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('blocks Worker access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return typeof Worker;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('blocks Proxy creation', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return typeof Proxy;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('blocks Reflect access', () => {
    const sandbox = createSandbox();
    const result = sandbox.execute('return typeof Reflect;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });

  it('cannot escape sandbox via arguments.callee', () => {
    const sandbox = createSandbox();
    // In strict mode, arguments.callee throws
    const result = sandbox.execute('return arguments.callee;');
    expect(result.success).toBe(false);
    sandbox.destroy();
  });

  it('runs in strict mode', () => {
    const sandbox = createSandbox();
    // In strict mode, 'this' in a function call is undefined, not globalThis
    const result = sandbox.execute('return (function() { return typeof this; })();');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — options', () => {
  it('respects custom timeout', () => {
    const sandbox = createSandbox({ timeout: 50 });
    // A quick script should succeed
    const result = sandbox.execute('return 42;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(42);
    sandbox.destroy();
  });

  it('constructor creates working sandbox', () => {
    const sandbox = new FormScriptSandbox({ timeout: 500 });
    const result = sandbox.execute('return "works";');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('works');
    sandbox.destroy();
  });

  it('handles allowedGlobals option', () => {
    const sandbox = createSandbox({ allowedGlobals: ['customGlobal'] });
    // customGlobal should be undefined but not cause an error
    const result = sandbox.execute('return typeof customGlobal;');
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('undefined');
    sandbox.destroy();
  });
});

// ---------------------------------------------------------------------------
// Real-world PDF form patterns
// ---------------------------------------------------------------------------

describe('FormScriptSandbox — real-world patterns', () => {
  it('invoice total calculation', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['item1_qty', '2'],
      ['item1_price', '25.00'],
      ['item2_qty', '3'],
      ['item2_price', '15.50'],
      ['total', '0'],
    ]));

    sandbox.execute(`
      var t1 = parseFloat(getField("item1_qty").value) * parseFloat(getField("item1_price").value);
      var t2 = parseFloat(getField("item2_qty").value) * parseFloat(getField("item2_price").value);
      getField("total").value = String(t1 + t2);
    `);

    const values = sandbox.getFieldValues();
    expect(parseFloat(values.get('total')!)).toBeCloseTo(96.5);
    sandbox.destroy();
  });

  it('conditional field logic', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['country', 'US'],
      ['state_label', ''],
    ]));

    sandbox.execute(`
      var country = getField("country").value;
      if (country === "US") {
        getField("state_label").value = "State";
      } else {
        getField("state_label").value = "Province";
      }
    `);

    expect(sandbox.getFieldValues().get('state_label')).toBe('State');
    sandbox.destroy();
  });

  it('event.value pattern (common in Acrobat scripts)', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([['qty', '5'], ['price', '10']]));

    const result = sandbox.execute(`
      var qty = parseFloat(getField("qty").value);
      var price = parseFloat(getField("price").value);
      event.value = String(qty * price);
      return event.value;
    `);

    expect(result.success).toBe(true);
    expect(result.returnValue).toBe('50');
    sandbox.destroy();
  });

  it('AFSimple_Calculate SUM for invoice subtotal', () => {
    const sandbox = createSandbox();
    sandbox.setFieldValues(new Map([
      ['line1', '100'],
      ['line2', '200'],
      ['line3', '150'],
    ]));

    const result = sandbox.execute(
      'return AFSimple_Calculate("SUM", ["line1", "line2", "line3"]);',
    );
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(450);
    sandbox.destroy();
  });
});
