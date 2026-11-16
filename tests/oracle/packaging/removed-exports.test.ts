/**
 * Removed exports: `webpToJpeg` and `webpToPng` only checked the RIFF header and then threw, so
 * 0.41.0 removed them. Neither is exported by the root entry or the browser entry, and the module
 * that held them no longer defines them. The route that works stays: `decodeWebP`,
 * `recompressWebP` and `encodePngFromPixels`.
 *
 * `AppendOptions` described the third parameter of `appendIncrementalUpdate()`, which 0.41.0 also
 * removed. It is an interface, so it leaves no runtime trace: the source of every entry and of
 * the module that declared it is read for its export names instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSync } from 'oxc-parser';
import type { ModuleExportName } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import * as browser from '../../../src/browser.js';
import * as webpOptimize from '../../../src/assets/image/webp/webpOptimize.js';
import * as root from '../../../src/index.js';
import { ROOT } from '../../../scripts/dev/api-snapshot.js';

const REMOVED = ['webpToJpeg', 'webpToPng'] as const;
const KEPT = ['decodeWebP', 'recompressWebP', 'encodePngFromPixels'] as const;

/** The package entries and the barrel of the signature folder, each of which listed `AppendOptions`. */
const ENTRY_SOURCES = [
  'src/index.ts',
  'src/browser.ts',
  'src/create.ts',
  'src/parse.ts',
  'src/forms.ts',
  'src/signature/index.ts',
] as const;

const exportName = (name: ModuleExportName): string =>
  name.type === 'Identifier' ? name.name : name.value;

/** The names a source file exports with an `export { ... }` list or an exported declaration. */
function exportedNames(path: string): string[] {
  const text = readFileSync(join(ROOT, path), 'utf8');
  const { program, errors } = parseSync(path, text, { lang: 'ts', sourceType: 'module' });
  expect(errors, `${path} parses`).toEqual([]);
  const names: string[] = [];
  for (const stmt of program.body) {
    if (stmt.type !== 'ExportNamedDeclaration') continue;
    for (const spec of stmt.specifiers) names.push(exportName(spec.exported));
    const declaration = stmt.declaration;
    if (
      declaration?.type === 'TSInterfaceDeclaration' ||
      declaration?.type === 'TSTypeAliasDeclaration'
    ) {
      names.push(declaration.id.name);
    }
  }
  return names;
}

describe.each([
  ['"."', root],
  ['"./browser"', browser],
] as const)('the entry %s', (_entry, entry) => {
  it.each(REMOVED)('does not export %s', (name) => {
    expect(Object.hasOwn(entry, name)).toBe(false);
  });

  it.each(KEPT)('still exports %s', (name) => {
    expect(typeof entry[name]).toBe('function');
  });
});

describe('the WebP optimization module', () => {
  it.each(REMOVED)('does not define %s', (name) => {
    expect(Object.hasOwn(webpOptimize, name)).toBe(false);
  });
});

describe('AppendOptions', () => {
  it.each(ENTRY_SOURCES)('is not exported by %s', (path) => {
    expect(exportedNames(path)).not.toContain('AppendOptions');
  });

  it('is not declared by the module of appendIncrementalUpdate', () => {
    expect(exportedNames('src/signature/pades/incrementalSave.ts')).not.toContain('AppendOptions');
  });
});
