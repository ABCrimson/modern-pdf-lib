/**
 * Tests of the static rules of the known-defect census (scripts/dev/known-defects.ts --check).
 *
 * Each case hands checkSource() the text of a test file and asserts the problems it reports.
 * The sources are strings, so the census of this repository does not see them as code.
 */
import { describe, expect, it } from 'vitest';
import { checkSource } from '../../../scripts/dev/known-defects.js';

const VERSION = '0.40.5';
const IMPORTS = [
  "import { describe, it, test } from 'vitest';",
  "import { defectKey, knownDefect } from '../helpers/known-defect.js';",
].join('\n');

const check = (body: string, file = 'tests/unit/sample.test.ts') =>
  checkSource(file, `${IMPORTS}\n${body}\n`, VERSION);

describe('checkSource: .fails outside the helper', () => {
  it.for([
    ['test.fails', "test.fails('x', () => {});"],
    ['a computed member with a string literal', "test['fails']('x', () => {});"],
    ['a computed member with a template literal', "it[`fails`]('x', () => {});"],
    ['a computed member in a chain', "describe['fails'].each([1])('x %i', () => {});"],
    ['a fails option', "test('x', { fails: true }, () => {});"],
    ['a computed fails option', "test('x', { ['fails']: true }, () => {});"],
    ['fails on an alias of test', "const t = test; t.fails('x', () => {});"],
    ['a destructured fails', "const { fails } = test; fails('x', () => {});"],
    ['a computed member of test with a non-literal key', "test['fa' + 'ils']('x', () => {});"],
  ] as const)('rejects %s', ([, body]) => {
    const { problems } = check(body);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^tests\/unit\/sample\.test\.ts:3: .*use knownDefect\(\)$/);
  });

  it('accepts a computed member that is not fails', () => {
    expect(check("test['skip']('x', () => {});").problems).toEqual([]);
  });
});

describe('checkSource: the key passed to knownDefect', () => {
  it('accepts a defectKey() call, a variable and a member that hold one', () => {
    const result = check(
      [
        "const KEY = defectKey('forms-34', '0.41.5');",
        "const known = { key: defectKey('core-page-01', '0.41.0') };",
        "knownDefect(defectKey('legacy-M01', '0.41.2'), 'a', { failsWith: /x/ }, () => {});",
        "knownDefect(KEY, 'b', { failsWith: /x/ }, () => {});",
        "knownDefect(known.key, 'c', { failsWith: /x/ }, () => {});",
      ].join('\n'),
    );
    expect(result).toEqual({ problems: [], marker: true });
  });

  it.for([
    [
      'an object literal',
      "knownDefect({ ids: ['forms-34'], until: '0.41.5', prefix: 'forms-34 (until 0.41.5)' }, 'x', { failsWith: /x/ }, () => {});",
    ],
    [
      'a spread of a defectKey() with an until of its own, cast',
      "knownDefect({ ...defectKey('forms-34', '0.41.5'), until: '0.40.1' } as never, 'x', { failsWith: /x/ }, () => {});",
    ],
    [
      'an object literal in parentheses with satisfies',
      "knownDefect(({ ids: ['forms-34'], until: '0.40.1', prefix: '' }) satisfies object as never, 'x', { failsWith: /x/ }, () => {});",
    ],
  ] as const)('rejects a hand-built key: %s', ([, body]) => {
    const { problems, marker } = check(body);
    expect(marker).toBe(true);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^tests\/unit\/sample\.test\.ts:3: a hand-built key: use defectKey\(\)$/,
    );
  });

  it('follows knownDefect imported under another name', () => {
    const source = [
      "import { knownDefect as marker } from '../helpers/known-defect.js';",
      "marker({ ids: ['forms-34'], until: '0.41.5', prefix: '' }, 'x', { failsWith: /x/ }, () => {});",
    ].join('\n');
    const { problems, marker } = checkSource('tests/unit/alias.test.ts', source, VERSION);
    expect(marker).toBe(true);
    expect(problems).toEqual(['tests/unit/alias.test.ts:2: a hand-built key: use defectKey()']);
  });

  it('reports a file that imports knownDefect without calling it as a marker file', () => {
    expect(check('').marker).toBe(true);
    expect(
      checkSource('tests/unit/none.test.ts', "import { test } from 'vitest';\n", VERSION),
    ).toEqual({ problems: [], marker: false });
  });
});

describe('checkSource: defectKey literals', () => {
  it('rejects an until that is not later than the package version', () => {
    expect(check("const K = defectKey('forms-34', '0.40.5');").problems).toEqual([
      'tests/unit/sample.test.ts:3: until 0.40.5 is not later than package.json version 0.40.5',
    ]);
  });

  it('rejects ids that are not literals', () => {
    expect(check("const id = 'forms-34'; const K = defectKey(id, '0.41.5');").problems).toEqual([
      'tests/unit/sample.test.ts:3: defectKey() without literal ids',
    ]);
  });
});
