/**
 * The metadata plugin carries out `creator`, `defaultTitle` and `defaultAuthor`, judged by two
 * outside readers (ISO 32000-2 14.3.3, the document information dictionary).
 *
 * qpdf `--json=2` reads the trailer's /Info dictionary; pdf.js `getMetadata().info` reads the
 * same dictionary through its own parser. `creator` is written when the plugin registers; the
 * default title and author are written at save, and only where the document has none, so a title
 * or author the caller set (before or after the plugin was registered) stays. Every file a test
 * saves passes `qpdf --check`. qpdf comes from `QPDF`, then `PATH`; the tests skip with a reason
 * where qpdf is absent locally and fail when `CI` is set.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { createPdf } from '../../src/index.js';
import type { PdfDocument } from '../../src/index.js';
import { metadataPlugin } from '../../src/plugins/index.js';
import type { MetadataPluginOptions } from '../../src/plugins/index.js';
import { withPdfjs } from '../helpers/oracle/pdfjs.js';
import { expectQpdfClean, QPDF_BIN, QpdfError, requireQpdf } from '../helpers/oracle/qpdf.js';

beforeEach((ctx) => {
  requireQpdf(ctx);
});

/** The /Info dictionary as qpdf `--json=2` reads it: each key (with its "/") to its value. */
type Info = Readonly<Record<string, unknown>>;

/** One qpdf `--json=2` object: the file's objects by "obj:N G R", and the trailer. */
interface QpdfJson {
  readonly qpdf: [unknown, Record<string, { readonly value?: unknown }>];
}

/** The /Info dictionary of `bytes` as qpdf reads it. */
function qpdfInfo(bytes: Uint8Array): Info {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-metadata-plugin-'));
  try {
    const input = join(dir, 'in.pdf');
    writeFileSync(input, bytes);
    const result = spawnSync(QPDF_BIN, ['--json=2', input], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new QpdfError(`qpdf --json=2 exit ${result.status}: ${result.stderr}`);
    }
    const objects = (JSON.parse(result.stdout) as QpdfJson).qpdf[1];
    const trailer = objects['trailer']?.value as Info | undefined;
    const reference = trailer?.['/Info'];
    if (typeof reference !== 'string') throw new Error('qpdf reports no /Info in the trailer');
    const info = objects[`obj:${reference}`]?.value;
    if (info === undefined) throw new Error(`qpdf reports no object ${reference}`);
    return info as Info;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The info dictionary pdf.js reads. */
const pdfjsInfo = (bytes: Uint8Array): Promise<Readonly<Record<string, unknown>>> =>
  withPdfjs(
    bytes,
    async (pdf) => (await pdf.getMetadata()).info as Readonly<Record<string, unknown>>,
  );

/** A one-page document with the plugin registered, `prepare` run on it, saved and checked. */
async function save(
  options: MetadataPluginOptions | undefined,
  prepare: (doc: PdfDocument) => void = () => {},
): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage();
  doc.use(metadataPlugin(options));
  prepare(doc);
  const bytes = await doc.save({ compress: false });
  expectQpdfClean(bytes);
  return bytes;
}

const ALL = {
  producer: 'Report generator',
  creator: 'Invoice app',
  defaultTitle: 'Invoice',
  defaultAuthor: 'Billing',
} as const;

describe('metadataPlugin creator, defaultTitle and defaultAuthor', () => {
  test('on an untitled document /Creator, /Title and /Author are written (qpdf and pdf.js)', async () => {
    const bytes = await save(ALL);

    expect(qpdfInfo(bytes)).toMatchObject({
      '/Producer': 'u:Report generator',
      '/Creator': 'u:Invoice app',
      '/Title': 'u:Invoice',
      '/Author': 'u:Billing',
    });
    expect(await pdfjsInfo(bytes)).toMatchObject({
      Producer: 'Report generator',
      Creator: 'Invoice app',
      Title: 'Invoice',
      Author: 'Billing',
    });
  });

  test('a title and an author the caller set before the plugin was registered are kept', async () => {
    const doc = createPdf();
    doc.addPage();
    doc.setTitle('Quarterly report');
    doc.setAuthor('Finance');
    doc.use(metadataPlugin(ALL));
    const bytes = await doc.save({ compress: false });
    expectQpdfClean(bytes);

    expect(qpdfInfo(bytes)).toMatchObject({
      '/Creator': 'u:Invoice app',
      '/Title': 'u:Quarterly report',
      '/Author': 'u:Finance',
    });
    expect(await pdfjsInfo(bytes)).toMatchObject({
      Creator: 'Invoice app',
      Title: 'Quarterly report',
      Author: 'Finance',
    });
  });

  test('a title and an author the caller set after the plugin was registered are kept', async () => {
    const bytes = await save(ALL, (doc) => {
      doc.setTitle('Set later');
      doc.setAuthor('Someone else');
    });

    expect(qpdfInfo(bytes)).toMatchObject({ '/Title': 'u:Set later', '/Author': 'u:Someone else' });
    expect(await pdfjsInfo(bytes)).toMatchObject({ Title: 'Set later', Author: 'Someone else' });
  });

  test('an empty title and an empty author count as empty and take the defaults', async () => {
    const bytes = await save(ALL, (doc) => {
      doc.setTitle('');
      doc.setAuthor('');
    });

    expect(qpdfInfo(bytes)).toMatchObject({ '/Title': 'u:Invoice', '/Author': 'u:Billing' });
    expect(await pdfjsInfo(bytes)).toMatchObject({ Title: 'Invoice', Author: 'Billing' });
  });

  test('each option acts alone: only the entries named are written', async () => {
    const bytes = await save({ defaultTitle: 'Invoice' });
    const info = qpdfInfo(bytes);

    expect(info).toMatchObject({ '/Title': 'u:Invoice', '/Producer': 'u:modern-pdf-lib' });
    expect(info).not.toHaveProperty('/Author');
    expect(info).not.toHaveProperty('/Creator');
    expect(Object.keys(await pdfjsInfo(bytes))).not.toContain('Author');
  });

  test('without the options the plugin writes only /Producer', async () => {
    const info = qpdfInfo(await save(undefined));

    expect(info).toMatchObject({ '/Producer': 'u:modern-pdf-lib' });
    for (const key of ['/Title', '/Author', '/Creator']) expect(info).not.toHaveProperty(key);
  });
});
