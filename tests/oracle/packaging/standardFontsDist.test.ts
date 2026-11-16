/**
 * The standard-font tables in the built package. standardFonts.ts builds its table of 14 fonts
 * with pure-annotated top-level calls, so a bundler may drop the width tables from an entry that
 * only needs the font names; an annotation is a promise, and the source tests cannot see what the
 * bundler did with it. This file loads the built dist/ files as a consumer does and checks that
 * the answers are right where the tables are kept (measuring and encoding through the root and
 * the create entries) and where they are dropped (the forms entry reads no width), and that a
 * consumer bundle of the forms entry carries no width table while one of the create entry does.
 * It needs dist/: locally it skips with a reason when dist/ is absent; with `CI` set it fails
 * instead (the CI job builds first).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import type { TestContext } from 'vitest';
import { ROOT } from '../../../scripts/dev/api-snapshot.js';

/** The part of a document of `createPdf()` these checks use. */
interface Document {
  readonly embedFont: (name: string) => Promise<FontRef>;
}

/** The part of a font of `embedFont()` these checks use. */
interface FontRef {
  readonly encodeText: (text: string) => Uint8Array;
  readonly widthOfTextAtSize: (text: string, size: number) => number;
}

/** The part of the create and root entries these checks use. */
interface CreateEntry {
  readonly createPdf: () => Document;
}

/** The part of the forms entry these checks use: the appearance stream of a text field. */
interface FormsEntry {
  readonly generateTextAppearance: (options: {
    readonly value: string;
    readonly rect: readonly [number, number, number, number];
    readonly fontName?: string;
  }) => { readonly data: Uint8Array };
}

/** The first 14 widths of the codes 0x60 up of Helvetica: no other table or entry holds this run. */
const HELVETICA_WIDTH_RUN = '333,556,556,500,556,556,278,556,556,222,222,500,222,833';

/** Skip locally, fail in CI, when dist/ is absent. */
function requireDist(ctx: TestContext): void {
  if (existsSync(join(ROOT, 'dist/index.mjs'))) return;
  const reason = 'dist/index.mjs absent: run `pnpm run build` first';
  if (process.env.CI) throw new Error(reason);
  ctx.skip(reason);
}

/** A built entry, loaded as a consumer loads it. */
async function load<T>(entry: string): Promise<T> {
  return (await import(pathToFileURL(join(ROOT, `dist/${entry}.mjs`)).href)) as T;
}

/** The consumer bundle of an entry, built as scripts/dev/size-gate.ts builds it, as text. */
async function bundleOf(entry: string): Promise<string> {
  const result = await build({
    stdin: {
      contents: `export * from './dist/${entry}.mjs';`,
      resolveDir: ROOT,
      sourcefile: 'standard-fonts-dist-entry.js',
      loader: 'js',
    },
    absWorkingDir: ROOT,
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    external: ['node:*'],
    write: false,
    logLevel: 'error',
  });
  const [out] = result.outputFiles;
  if (out === undefined) throw new Error('esbuild wrote no output');
  return out.text;
}

describe.each(['index', 'create'])('the %s entry', (entry) => {
  it('measures and encodes text in the standard fonts', async (ctx) => {
    requireDist(ctx);
    const { createPdf } = await load<CreateEntry>(entry);
    const pdf = createPdf();

    const helvetica = await pdf.embedFont('Helvetica');
    // H 722, e 556, l 222, l 222, o 556 in thousandths of a point at 12 points.
    expect(helvetica.widthOfTextAtSize('Hello', 12)).toBeCloseTo(27.336, 9);
    expect([...helvetica.encodeText('Hello')]).toEqual([72, 101, 108, 108, 111]);

    const courier = await pdf.embedFont('Courier-BoldOblique');
    expect(courier.widthOfTextAtSize('Hello', 12)).toBeCloseTo(36, 9);

    // Symbol encodes its own character set: the Greek letters are codes 0x61 0x62 0x67.
    const symbol = await pdf.embedFont('Symbol');
    expect([...symbol.encodeText('αβγ')]).toEqual([0x61, 0x62, 0x67]);
    expect(symbol.widthOfTextAtSize('αβγ', 10)).toBeGreaterThan(0);
  });
});

describe('the forms entry', () => {
  it('names the standard fonts: a standard font name encodes through that font', async (ctx) => {
    requireDist(ctx);
    const { generateTextAppearance } = await load<FormsEntry>('forms');
    const appearance = (fontName: string, value: string): string =>
      new TextDecoder('latin1').decode(
        generateTextAppearance({ value, rect: [0, 0, 200, 30], fontName }).data,
      );

    // Symbol is a standard font name here, so the Greek letters have codes; Helvetica has none.
    expect(appearance('Symbol', 'αβγ')).toContain('(abg) Tj');
    expect(() => appearance('NoSuchFont', 'αβγ')).toThrow(
      expect.objectContaining({ code: 'unencodable-text' }),
    );
    expect(appearance('Courier', 'Hello')).toContain('(Hello) Tj');
  });

  it('keeps the width tables out of a consumer bundle of the forms entry, and in the others', async (ctx) => {
    requireDist(ctx);
    // A boolean, not the text: a failure must not print the whole bundle.
    const holdsWidths = async (entry: string): Promise<boolean> =>
      (await bundleOf(entry)).includes(HELVETICA_WIDTH_RUN);
    expect(await holdsWidths('forms'), 'forms bundle holds the Helvetica widths').toBe(false);
    expect(await holdsWidths('create'), 'create bundle holds the Helvetica widths').toBe(true);
  });
});
