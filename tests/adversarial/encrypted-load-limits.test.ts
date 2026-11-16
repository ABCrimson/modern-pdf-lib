/**
 * Decoded-size limit on the load path of an encrypted file, under the budgeted runner. The input
 * is an AES-128 (R4) file with an empty user password, built here: its object stream is
 * encrypted, and its decrypted data is zlib data of 300 MiB of zero bytes, above
 * `maxDecodedStreamBytes` (256 MiB). Loading it ends in ResourceLimitError within DEFAULT_BUDGET
 * (2 s, 512 MiB of resident memory growth): the object stream is decrypted before its members
 * are read, and the limit error is not turned into a skipped object. The control, the same file
 * with a small object stream, loads.
 *
 * Cost of the strings of one object: an AES-128 file, empty user password, whose one array holds
 * 100,000 distinct strings (written by encrypt() and save()), loads with every string decrypted
 * within MANY_STRINGS_BUDGET: the memory of DEFAULT_BUDGET and five times its time, because a
 * hosted CI runner needs more than 2 s for this valid file.
 */
import { createDeflate, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PdfEncryptionHandler } from '../../src/crypto/encryptionHandler.js';
import { createPdf } from '../../src/core/pdfDocument.js';
import { PdfArray, PdfString } from '../../src/core/pdfObjects.js';
import { type Budget, DEFAULT_BUDGET, runWithinBudget, timeLimitMs } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/encrypted-load-limits.bodies.ts';
const MIB = 1024 * 1024;
// Building the input and the runner's start-up come before the budget clock.
const TIMEOUT = 60_000;
/** The budget of the valid 100,000-string file (see the file comment). */
const MANY_STRINGS_BUDGET: Budget = { ms: 5 * DEFAULT_BUDGET.ms, mib: DEFAULT_BUDGET.mib };

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** zlib data (level 1) of `mib` MiB of zero bytes, written to a deflate stream one MiB at a time. */
async function zlibOfZeros(mib: number): Promise<Uint8Array> {
  const deflater = createDeflate({ level: 1 });
  const parts: Uint8Array[] = [];
  deflater.on('data', (part: Uint8Array) => parts.push(part));
  const ended = new Promise<void>((done) => deflater.on('end', done));
  const zeros = new Uint8Array(MIB);
  for (let i = 0; i < mib; i++) {
    if (!deflater.write(zeros)) await new Promise((done) => deflater.once('drain', done));
  }
  deflater.end();
  await ended;
  return concat(...parts);
}

/**
 * An R4 AES-128 file, empty user password: catalog, pages and page in use, object 4 inside the
 * object stream 5 whose plaintext is `objStm` (zlib data, /N 1, /First `first`), the /Encrypt
 * dictionary 6, and the cross-reference stream 7.
 */
async function encryptedWithObjectStream(objStm: Uint8Array, first: number): Promise<Uint8Array> {
  const fileId = new Uint8Array(16).fill(0x42);
  const handler = await PdfEncryptionHandler.create(
    { userPassword: '', ownerPassword: 'owner', algorithm: 'aes-128' },
    fileId,
  );
  const encrypted = await handler.encryptObject(5, 0, objStm);
  const dict = handler.buildEncryptDict();
  const hexOf = (key: string): string => {
    return (dict.get(key) as PdfString).toBytes().toHex();
  };
  const encryptBody = `<< /Filter /Standard /V 4 /R 4 /Length 128 /P ${handler.getPermissionsValue()} /CF << /StdCF << /CFM /AESV2 /AuthEvent /DocOpen /Length 16 >> >> /StmF /StdCF /StrF /StdCF /O <${hexOf('/O')}> /U <${hexOf('/U')}> >>`;

  const pieces: Uint8Array[] = [latin1('%PDF-1.7\n')];
  const offsets = new Map<number, number>();
  let pos = pieces[0]!.length;
  const add = (piece: Uint8Array): void => {
    pieces.push(piece);
    pos += piece.length;
  };
  const object = (num: number, body: Uint8Array): void => {
    offsets.set(num, pos);
    add(concat(latin1(`${num} 0 obj\n`), body, latin1('\nendobj\n')));
  };
  object(1, latin1('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  object(3, latin1('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'));
  object(
    5,
    concat(
      latin1(
        `<< /Type /ObjStm /N 1 /First ${first} /Filter /FlateDecode /Length ${encrypted.length} >>\nstream\n`,
      ),
      encrypted,
      latin1('\nendstream'),
    ),
  );
  object(6, latin1(encryptBody));

  // Cross-reference stream, /W [1 4 2], unfiltered.
  const xrefAt = pos;
  const rows = new Uint8Array(8 * 7);
  const row = (num: number, type: number, a: number, b: number): void => {
    const at = num * 7;
    rows[at] = type;
    new DataView(rows.buffer).setUint32(at + 1, a);
    new DataView(rows.buffer).setUint16(at + 5, b);
  };
  row(0, 0, 0, 0xffff);
  for (const num of [1, 2, 3, 5, 6]) row(num, 1, offsets.get(num)!, 0);
  row(4, 2, 5, 0);
  row(7, 1, xrefAt, 0);
  const id = fileId.toHex();
  add(
    concat(
      latin1(
        `7 0 obj\n<< /Type /XRef /Size 8 /W [1 4 2] /Root 1 0 R /Encrypt 6 0 R /ID [<${id}><${id}>] /Length ${rows.length} >>\nstream\n`,
      ),
      rows,
      latin1(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`),
    ),
  );
  return concat(...pieces);
}

describe('encrypted load: decoded-size limit of a decrypted object stream', () => {
  it(
    'control: a small encrypted object stream loads',
    async () => {
      const header = '4 0 ';
      const input = await encryptedWithObjectStream(
        deflateSync(latin1(`${header}<< /Control true >>`)),
        header.length,
      );
      const outcome = await runWithinBudget(
        { module: BODIES, entry: 'loadEncryptedEntry', input },
        DEFAULT_BUDGET,
      );
      expect(outcome).toMatchObject({ kind: 'completed', result: { pages: 1 } });
    },
    TIMEOUT,
  );

  it(
    'an object stream that decrypts to 300 MiB of zlib zeros ends in ResourceLimitError',
    async () => {
      const input = await encryptedWithObjectStream(await zlibOfZeros(300), 4);
      const outcome = await runWithinBudget(
        { module: BODIES, entry: 'loadEncryptedEntry', input },
        DEFAULT_BUDGET,
      );
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        limit: 'maxDecodedStreamBytes',
      });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
    },
    TIMEOUT,
  );
});

describe('encrypted load: the strings of one object', () => {
  it(
    'an array of 100,000 AES strings loads within MANY_STRINGS_BUDGET, every string decrypted',
    async () => {
      const count = 100_000;
      const doc = createPdf();
      doc.addPage();
      doc
        .getRegistry()
        .register(
          new PdfArray(Array.from({ length: count }, (_, i) => PdfString.fromText(`s${i}`))),
        );
      await doc.encrypt({ userPassword: '', ownerPassword: 'owner', algorithm: 'aes-128' });
      const input = await doc.save();
      const outcome = await runWithinBudget(
        { module: BODIES, entry: 'loadStringsEntry', input },
        MANY_STRINGS_BUDGET,
      );
      expect(outcome).toMatchObject({
        kind: 'completed',
        result: { items: count, matching: count },
      });
    },
    TIMEOUT,
  );
});
