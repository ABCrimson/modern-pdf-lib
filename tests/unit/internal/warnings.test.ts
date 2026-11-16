/**
 * Tests for the runtime warning channel (src/internal/warnings.ts): once per key per realm, the
 * `process.emitWarning` sink with the library's warning type and a stable code, the
 * `console.warn` fallback, the guarded sinks, and the test-only reset.
 */

import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { PdfStructureTree } from '../../../src/accessibility/structureTree.js';
import { tagTableHeaderCell } from '../../../src/accessibility/taggingHelpers.js';
import { resetWarningsForTesting, WARNING_TYPE, warnOnce } from '../../../src/internal/warnings.js';

const REGISTRY = Symbol.for('modern-pdf-lib.warnings');

beforeEach(() => {
  resetWarningsForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

describe('warnOnce', () => {
  it('takes only the codes of the warnings that are still emitted', () => {
    // Since 0.41.0 an option the library cannot honour throws UnsupportedOptionError, so no code
    // for "an option was ignored" is left.
    expectTypeOf<Parameters<typeof warnOnce>[1]>().toEqualTypeOf<
      'MPL_LEGACY_R6_KEY' | 'MPL_OCR_UNENCODABLE'
    >();
  });

  it('emits once per key through process.emitWarning with the type and the code', () => {
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

    expect(warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).toBe(true);
    expect(warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).toBe(false);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('m1', {
      type: 'ModernPdfLibWarning',
      code: 'MPL_LEGACY_R6_KEY',
    });
    expect(WARNING_TYPE).toBe('ModernPdfLibWarning');
  });

  it('emits once for each of two keys', () => {
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

    warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1');
    warnOnce('k2', 'MPL_LEGACY_R6_KEY', 'm2');
    warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1');
    warnOnce('k2', 'MPL_LEGACY_R6_KEY', 'm2');

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, 'm1', {
      type: 'ModernPdfLibWarning',
      code: 'MPL_LEGACY_R6_KEY',
    });
    expect(emit).toHaveBeenNthCalledWith(2, 'm2', {
      type: 'ModernPdfLibWarning',
      code: 'MPL_LEGACY_R6_KEY',
    });
  });

  it('keeps the emitted keys in a realm-wide set that a fresh module instance shares', async () => {
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

    warnOnce('shared', 'MPL_LEGACY_R6_KEY', 'm');
    const registry = (globalThis as Record<symbol, unknown>)[REGISTRY];
    expect(registry).toBeInstanceOf(Set);
    expect((registry as Set<string>).has('shared')).toBe(true);

    vi.resetModules();
    const fresh = await import('../../../src/internal/warnings.js');
    expect(fresh.warnOnce('shared', 'MPL_LEGACY_R6_KEY', 'm')).toBe(false);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('falls back to console.warn where process.emitWarning is absent', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    // The spy is an own property of `process`; undefined stands for a runtime without it.
    (process as { emitWarning: unknown }).emitWarning = undefined;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).toBe(true);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('ModernPdfLibWarning [MPL_LEGACY_R6_KEY]: m1');
  });

  it('falls back to console.warn when process.emitWarning throws', () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {
      throw new Error('sink');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).toBe(true);
    expect(warn).toHaveBeenCalledWith('ModernPdfLibWarning [MPL_LEGACY_R6_KEY]: m1');
  });

  it('never throws when both sinks throw, and the key stays recorded', () => {
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {
      throw new Error('emit');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('warn');
    });

    expect(() => warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).not.toThrow();
    expect(warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).toBe(false);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('re-arms every key after resetWarningsForTesting', () => {
    const emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

    warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1');
    resetWarningsForTesting();
    expect(warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1')).toBe(true);

    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('reaches a spy and a warning listener under the suite flag that silences the type', async () => {
    // vitest.config.ts passes --disable-warning=ModernPdfLibWarning to every worker: Node then
    // prints nothing for the type, while a spy and a 'warning' listener still see each call.
    expect(process.execArgv).toContain('--disable-warning=ModernPdfLibWarning');
    const emit = vi.spyOn(process, 'emitWarning');
    const seen: Array<{ name: string; code: unknown; message: string }> = [];
    const listener = (w: Error & { code?: unknown }): void => {
      seen.push({ name: w.name, code: w.code, message: w.message });
    };
    process.on('warning', listener);
    try {
      warnOnce('k1', 'MPL_LEGACY_R6_KEY', 'm1');
      // Node fires 'warning' on the next tick.
      await new Promise<void>((resolve) => {
        process.nextTick(resolve);
      });
    } finally {
      process.off('warning', listener);
    }

    expect(emit).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([
      { name: 'ModernPdfLibWarning', code: 'MPL_LEGACY_R6_KEY', message: 'm1' },
    ]);
  });
});

describe('warnOnce on a global object that cannot take the shared set', () => {
  it('never throws and still warns once when globalThis is not extensible', () => {
    const moduleUrl = new URL('../../../src/internal/warnings.ts', import.meta.url).href;
    const script = `
      const { warnOnce } = await import(${JSON.stringify(moduleUrl)});
      process.emitWarning = () => {};
      Object.preventExtensions(globalThis);
      const first = warnOnce('frozen', 'MPL_LEGACY_R6_KEY', 'm');
      const second = warnOnce('frozen', 'MPL_LEGACY_R6_KEY', 'm');
      console.log(String(first) + ' ' + String(second));
    `;
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe('true false');
  });
});

describe('tagTableHeaderCell reads options.scope as often as 0.40.8 did', () => {
  it('reads a scope getter once when no scope argument is passed', () => {
    const tree = new PdfStructureTree();
    const row = tree.addElement(null, 'TR');
    let reads = 0;
    const options = {
      get scope() {
        reads += 1;
        return undefined;
      },
    };

    const header = tagTableHeaderCell(tree, row, undefined, options);

    expect(reads).toBe(1);
    expect(header.options.scope).toBe('Column');
  });
});
