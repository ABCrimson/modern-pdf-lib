/**
 * Tests of the runtime rule of the known-defect census (scripts/dev/known-defects.ts --check):
 * every test file of every project is collected through the `vitest/node` API, and
 * a collected test with `fails` set and no `meta.ledger` is a problem, however its options were
 * written.
 *
 * Each case writes probe test files into a fresh directory outside the repository, with a
 * Vitest config of its own (globals, so the probes import nothing), collects it with
 * collectAllTests() and collectMarkers(), and asserts what they report. The probe sources are
 * strings here, so the census of this repository does not see them as code, and the probe files
 * import nothing from this repository: none of them registers knownDefect().
 */
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectAllTests, collectMarkers } from '../../../scripts/dev/known-defects.js';

const PROBES: Record<string, string> = {
  // The key `fails` is built at run time, so no source rule can name it.
  'computed-key.test.ts': [
    "const k = ['fa', 'ils'].join('');",
    "test('a computed option key', { [k]: true }, () => { throw new Error('x'); });",
  ].join('\n'),
  'reflect-get.test.ts': [
    "const runner = Reflect.get(test, ['fa', 'ils'].join(''));",
    "runner('a runner reached through Reflect.get', () => { throw new Error('x'); });",
  ].join('\n'),
  'runtime-options.test.ts':
    "test('options parsed at run time', JSON.parse('{\"fai' + 'ls\": true}'), () => { throw new Error('x'); });",
  'keyed.test.ts': [
    "const meta = { ledger: { ids: ['probe-gap-01'], until: '9.0.0' } };",
    "test('probe-gap-01 (until 9.0.0): a keyed expected failure', { fails: true, meta }, () => { throw new Error('x'); });",
    "test('a plain test', () => {});",
  ].join('\n'),
};

let root = '';

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'known-defects-collect-')));
  writeFileSync(
    join(root, 'vitest.config.mjs'),
    "export default { test: { globals: true, include: ['*.test.ts'] } };\n",
  );
  for (const [name, source] of Object.entries(PROBES)) {
    writeFileSync(join(root, name), `${source}\n`);
  }
});

afterAll(() => {
  if (root !== '') rmSync(root, { recursive: true, force: true });
});

const config = (): string => join(root, 'vitest.config.mjs');

describe('collectAllTests', () => {
  it('collects every test file, not only those that import knownDefect', async () => {
    const { tests, problems } = await collectAllTests(root, { config: config() });
    expect(problems).toEqual([]);
    expect(tests.map((t) => `${t.file}: ${t.name}`).toSorted()).toEqual([
      'computed-key.test.ts: a computed option key',
      'keyed.test.ts: a plain test',
      'keyed.test.ts: probe-gap-01 (until 9.0.0): a keyed expected failure',
      'reflect-get.test.ts: a runner reached through Reflect.get',
      'runtime-options.test.ts: options parsed at run time',
    ]);
    // Read through Reflect.get: the static census rejects a member named `fails` in tests/.
    expect(tests.filter((t) => Reflect.get(t, 'fails') === true).map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'a computed option key',
        'a runner reached through Reflect.get',
        'options parsed at run time',
        'probe-gap-01 (until 9.0.0): a keyed expected failure',
      ]),
    );
    expect(tests.filter((t) => Reflect.get(t, 'fails') === true)).toHaveLength(4);
  }, 120_000);
});

describe('collectMarkers: the runtime rule', () => {
  it('rejects an expected failure without a ledger key, however its options were built', async () => {
    const { markers, problems } = await collectMarkers(root, { config: config() });
    expect(problems.toSorted()).toEqual([
      'computed-key.test.ts: "a computed option key" expects a failure without knownDefect()',
      'reflect-get.test.ts: "a runner reached through Reflect.get" expects a failure without knownDefect()',
      'runtime-options.test.ts: "options parsed at run time" expects a failure without knownDefect()',
    ]);
    expect(markers).toEqual([
      {
        ids: ['probe-gap-01'],
        until: '9.0.0',
        file: 'keyed.test.ts',
        title: 'probe-gap-01 (until 9.0.0): a keyed expected failure',
      },
    ]);
  }, 120_000);
});
