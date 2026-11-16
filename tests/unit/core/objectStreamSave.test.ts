/**
 * Saving a loaded unencrypted file whose objects live in object streams.
 *
 * The loader reads each object-stream container once per load: a save defines a container's
 * object number no more often than it defines the other stream objects of the file. Up to
 * 0.40.8 every read of an object inside a container registered one more copy of the container,
 * and the save wrote each copy (irs-fw4.pdf: 45 containers, 874,040 bytes; one copy fewer of
 * each, 821,063 bytes). qpdf reads the same objects from both outputs.
 *
 * Up to 0.40.9 a save also defined most objects read at a file offset twice: the loader
 * registers each of them twice, and the writer wrote both entries (irs-fw4.pdf: 3,714
 * definitions of 3,600 object numbers, 821,063 bytes; once each, 610,004 bytes). It defines
 * each object number once.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPdf } from '../../../src/parser/documentParser.js';
import type { PdfDict, PdfStream } from '../../../src/core/pdfObjects.js';

const CORPUS = join(import.meta.dirname, '../../fixtures/corpus');

/** Corpus files whose objects live in object streams (one or more /Type /ObjStm containers). */
const FILES = [
  'qpdf-objstm-xref.pdf',
  'qpdf-linearized.pdf',
  'qpdf-signed.pdf',
  'irs-p1-chinese.pdf',
  'irs-fw9.pdf',
  'irs-fw4.pdf',
] as const;

interface Saved {
  /** Object number -> how many times the saved file defines it (`N G obj`). */
  readonly definitions: ReadonlyMap<number, number>;
  /** Object numbers of the /Type /ObjStm containers. */
  readonly containers: ReadonlySet<number>;
  /** Object numbers of the other streams, cross-reference streams left out. */
  readonly streams: ReadonlySet<number>;
}

/** Loads a corpus file, saves it, and counts the object definitions of the output. */
async function loadAndSave(name: string): Promise<Saved> {
  const doc = await loadPdf(new Uint8Array(readFileSync(join(CORPUS, name))));
  const containers = new Set<number>();
  const streams = new Set<number>();
  for (const { ref, object } of doc.getRegistry()) {
    if (object.kind !== 'stream') continue;
    const type = ((object as PdfStream).dict as PdfDict).get('/Type');
    const typeName = type?.kind === 'name' ? type.value : undefined;
    if (typeName === '/ObjStm') containers.add(ref.objectNumber);
    else if (typeName !== '/XRef') streams.add(ref.objectNumber);
  }
  const text = new TextDecoder('latin1').decode(await doc.save({ addDefaultPage: false }));
  const definitions = new Map<number, number>();
  for (const m of text.matchAll(/(?<=^|[\r\n])(\d+) \d+ obj\b/g)) {
    const num = Number(m[1]);
    definitions.set(num, (definitions.get(num) ?? 0) + 1);
  }
  return { definitions, containers, streams };
}

describe('save of a loaded file with object streams', () => {
  it.each(FILES)(
    '%s: each container is defined no more often than the other streams',
    async (name) => {
      const { definitions, containers, streams } = await loadAndSave(name);
      expect(containers.size).toBeGreaterThan(0);
      expect(streams.size).toBeGreaterThan(0);
      const most = Math.max(...Iterator.from(streams).map((n) => definitions.get(n) ?? 0));
      const over = Iterator.from(containers)
        .filter((n) => (definitions.get(n) ?? 0) > most)
        .map((n) => `${n}: ${definitions.get(n)} > ${most}`)
        .toArray();
      expect(over).toEqual([]);
    },
  );

  it('qpdf-objstm-xref.pdf (one revision): the save defines each object number once', async () => {
    const { definitions } = await loadAndSave('qpdf-objstm-xref.pdf');
    const repeated = [...definitions].filter(([, count]) => count > 1);
    expect(repeated).toEqual([]);
  });
});
