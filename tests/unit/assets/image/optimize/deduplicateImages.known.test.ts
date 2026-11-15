/**
 * Known defect of deduplicateImages(); the marker below carries its ledger id.
 *
 * Two image XObjects with the same width, height, filters and stream bytes are merged even
 * when their image dictionaries differ in an entry that changes how they render. Here the
 * second copy carries a /Decode array that inverts every colour component, so the two copies
 * draw differently and must both survive deduplication.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import {
  createPdf,
  deduplicateImages,
  extractImages,
  loadPdf,
  PageSizes,
  PdfArray,
} from '../../../../../src/index.js';
import { defectKey, knownDefect } from '../../../../helpers/known-defect.js';

const fixturesDir = resolve(import.meta.dirname, '../../../../fixtures/images');

knownDefect(
  defectKey('images-12', '0.41.2'),
  'two copies of one image that differ in /Decode are not merged',
  { failsWith: /^AssertionError: expected 1 to be \+0/ },
  async () => {
    const pngBytes = new Uint8Array(await readFile(resolve(fixturesDir, 'sample.png')));
    const doc = createPdf();
    const first = await doc.embedPng(pngBytes);
    const second = await doc.embedPng(pngBytes);
    const page = doc.addPage(PageSizes.A4);
    page.drawImage(first, { x: 0, y: 0, width: 50, height: 50 });
    page.drawImage(second, { x: 100, y: 0, width: 50, height: 50 });
    const loaded = await loadPdf(await doc.save());

    const images = extractImages(loaded);
    expect(images).toHaveLength(2);
    const inverted = images[1];
    if (inverted === undefined) throw new Error('second image missing');
    // /Decode [1 0 1 0 ...]: each colour component of the second copy is drawn inverted.
    inverted.stream.dict.set(
      '/Decode',
      PdfArray.fromNumbers(Array.from({ length: inverted.channels }, () => [1, 0]).flat()),
    );

    const report = deduplicateImages(loaded);
    expect(report.duplicatesRemoved).toBe(0);
    expect(report.uniqueImages).toBe(2);
  },
);
