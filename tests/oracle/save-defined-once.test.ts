/**
 * A save of a loaded corpus file defines each object number once, and qpdf reads exactly the
 * objects it defines.
 *
 * Every file of tests/fixtures/corpus/ is loaded and saved, through the classic cross-reference
 * table (`save()`) and, for an unencrypted file, through object streams
 * (`objectStreamThreshold: 1`); an encrypted file is encrypted with new passwords (AES-256)
 * first. Of each output: no object number has a second definition (an `N G obj` header or an
 * object stream member), qpdf `--json=2` lists the same object numbers the file defines, qpdf
 * counts the manifest's pages, the trailer's /Root is a /Catalog, and `qpdf --check` passes.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { TestContext } from 'vitest';
import { loadPdf } from '../../src/index.js';
import type { PdfSaveOptions } from '../../src/index.js';
import { objectDefinitions, repeatedDefinitions } from '../helpers/objectDefinitions.js';
import { expectQpdfClean, QPDF_BIN, QpdfError, requireQpdf } from '../helpers/oracle/qpdf.js';

interface CorpusEntry {
  readonly id: string;
  readonly file: string;
  readonly features: readonly string[];
  readonly password: string | null;
  readonly oracle: { readonly pages: number };
}

const DIR = new URL('../fixtures/corpus/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', DIR), 'utf8'),
) as readonly CorpusEntry[];

const isEncrypted = (entry: CorpusEntry): boolean =>
  entry.features.some((f) => f.startsWith('encrypted-'));
const RESAVE_USER = 'user-resave';
const RESAVE_OWNER = 'owner-resave';

interface QpdfReading {
  /** Object number of each object qpdf lists. */
  readonly objects: readonly number[];
  readonly root: unknown;
  readonly pages: number;
}

/** qpdf `--json=2` (the objects and the trailer) and `--show-npages` of `bytes`. */
function qpdfRead(bytes: Uint8Array, password: string | undefined): QpdfReading {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-defined-once-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, bytes);
    const run = (...args: string[]): string => {
      const pw = password === undefined ? [] : [`--password=${password}`];
      // Exit 3 (warnings) still writes the reading; the qpdf --check of each test judges them.
      const result = spawnSync(QPDF_BIN, [...pw, ...args, input], {
        encoding: 'utf8',
        maxBuffer: 1 << 30,
      });
      if (result.status !== 0 && result.status !== 3) {
        throw new QpdfError(`qpdf ${args.join(' ')} exit ${result.status}: ${result.stderr}`);
      }
      return result.stdout;
    };
    const json = JSON.parse(run('--json=2', '--json-key=qpdf')) as {
      qpdf: [
        unknown,
        { trailer: { value: { '/Root': string } } } & Record<string, { value?: unknown }>,
      ];
    };
    const entries = json.qpdf[1];
    const objects = Object.keys(entries)
      .filter((key) => key.startsWith('obj:'))
      .map((key) => Number(/^obj:(\d+) /.exec(key)![1]));
    const root = entries[`obj:${entries.trailer.value['/Root']}`]?.value;
    return { objects, root, pages: Number(run('--show-npages').trim()) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ROUTES: readonly { readonly name: string; readonly options: PdfSaveOptions }[] = [
  { name: 'save()', options: {} },
  { name: 'save({ objectStreamThreshold: 1 })', options: { objectStreamThreshold: 1 } },
];

describe('a save of a loaded corpus file defines each object number once', () => {
  for (const entry of manifest) {
    for (const route of ROUTES) {
      // Object streams are not encrypted, so an encrypted save refuses them.
      if (isEncrypted(entry) && route.options.objectStreamThreshold !== undefined) continue;
      const title = `${entry.file} ${route.name}`;
      const body = async (ctx: TestContext): Promise<void> => {
        requireQpdf(ctx);
        const bytes = new Uint8Array(readFileSync(new URL(entry.file, DIR)));
        const doc = await loadPdf(
          bytes,
          entry.password === null ? {} : { password: entry.password },
        );
        if (isEncrypted(entry)) {
          await doc.encrypt({
            userPassword: RESAVE_USER,
            ownerPassword: RESAVE_OWNER,
            algorithm: 'aes-256',
          });
        }
        const saved = await doc.save(route.options);
        const password = isEncrypted(entry) ? RESAVE_USER : undefined;

        expect(repeatedDefinitions(saved), 'object numbers defined more than once').toEqual([]);
        const read = qpdfRead(saved, password);
        const defined = [...objectDefinitions(saved).keys()].toSorted((a, b) => a - b);
        expect(
          read.objects.toSorted((a, b) => a - b),
          'objects qpdf lists',
        ).toEqual(defined);
        expect(read.pages, 'qpdf --show-npages').toBe(entry.oracle.pages);
        expect(read.root, 'trailer /Root').toMatchObject({ '/Type': '/Catalog' });
        expectQpdfClean(saved, password === undefined ? {} : { password });
      };
      test(title, body);
    }
  }
});
