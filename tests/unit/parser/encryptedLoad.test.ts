/**
 * loadPdf of encrypted files: every object comes back decrypted, once.
 *
 * The fixtures are tests/fixtures/encrypted (qpdf 12.4.2 copies of source.pdf, and R4 AESV2 and
 * RC4 files built by scripts/fixtures/encrypted-fixtures.ts). Their plaintext is source.pdf: one page
 * whose content is `BT /F1 24 Tf 72 720 Td (Oracle text) Tj ET`, Info /Title `Oracle fixture`
 * and an XMP stream holding the same title; the built files add a catalog /Lang `en-US` (hex
 * string) and an Info /Author `Author (lit)` (literal string of octal escapes).
 *
 * What is not encrypted (ISO 32000-2:2020):
 * - 7.6.1: "Encryption applies to all strings and streams in the document's PDF file, with the
 *   following exceptions: The values for the ID entry in the trailer; Any strings in an Encrypt
 *   dictionary; Any strings that are inside streams such as content streams and compressed
 *   object streams, which themselves are encrypted." (7.5.7: an object stream is encrypted as a
 *   whole; 7.5.8: cross-reference streams are not encrypted.)
 * - 7.6.3.1: with /EncryptMetadata false the document-level metadata stream (the one the catalog's
 *   /Metadata names) is not encrypted; every other /Type /Metadata stream is (qpdf
 *   --cleartext-metadata writes and reads load/sig-shapes-aes-128-r4-nometa.pdf that way).
 * - 7.6.6: the /Identity crypt filter passes data through unchanged, for /StmF, /StrF and a
 *   stream's own /Crypt filter.
 * - 7.6.1 and 12.8.1: the /Contents of a signature dictionary is not encrypted. The dictionary is
 *   one whose /Type is /Sig or /DocTimeStamp, or that has no /Type and has /ByteRange and
 *   /Contents. qpdf 12.4.2 exempts only /Type /Sig with /ByteRange (load/signed-aes-128.pdf is its
 *   AESV2 copy of the corpus file qpdf-signed.pdf); tests/oracle/encrypted-qdf.test.ts states the
 *   three shapes where the two differ.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestContext } from 'vitest';
import { loadPdf } from '../../../src/parser/documentParser.js';
import { createPdf } from '../../../src/core/pdfDocument.js';
import type { PdfDocument } from '../../../src/core/pdfDocument.js';
import { mergePdfs } from '../../../src/core/documentMerge.js';
import { PdfEncryptionHandler } from '../../../src/crypto/encryptionHandler.js';
import { PdfRef } from '../../../src/core/pdfObjects.js';
import type { PdfDict, PdfObject, PdfStream, PdfString } from '../../../src/core/pdfObjects.js';
import { decodeStreamData } from '../../../src/codecs/streamDecode.js';
import { extractText, parseContentStream } from '../../../src/index.js';
import { EncryptedPdfError, UnsupportedEncryptionError } from '../../../src/errors.js';
import { qpdfDecryptQdf, requireQpdf } from '../../helpers/oracle/qpdf.js';

const DIR = join(import.meta.dirname, '../../fixtures/encrypted');
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(DIR, name)));
const latin1 = (bytes: Uint8Array): string => String.fromCharCode(...bytes);
const bytesOf = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

const CONTENT = 'BT /F1 24 Tf 72 720 Td (Oracle text) Tj ET';
const TEXT = 'Oracle text';
const TITLE = 'Oracle fixture';

/** The registry entry whose dictionary has `/Type typeName`. */
function findByType(doc: PdfDocument, typeName: string): { ref: PdfRef; object: PdfObject }[] {
  const found: { ref: PdfRef; object: PdfObject }[] = [];
  for (const entry of doc.getRegistry()) {
    const dict =
      entry.object.kind === 'stream'
        ? (entry.object as PdfStream).dict
        : entry.object.kind === 'dict'
          ? (entry.object as PdfDict)
          : undefined;
    const type = dict?.get('/Type');
    if (type?.kind === 'name' && type.value === typeName) found.push(entry);
  }
  return found;
}

/** What a reader sees of the document: the values the tests below compare with the plaintext. */
function observe(doc: PdfDocument): {
  pages: number;
  content: string;
  text: string;
  title: string | undefined;
  xmp: boolean;
} {
  const content = latin1(doc.getPage(0).getContentStream()).trim();
  const metadata = findByType(doc, '/Metadata')[0]?.object as PdfStream | undefined;
  return {
    pages: doc.getPageCount(),
    content,
    text: extractText(parseContentStream(doc.getPage(0).getContentStream())).trim(),
    title: doc.getTitle(),
    xmp: metadata !== undefined && latin1(decodeStreamData(metadata)).includes(TITLE),
  };
}

const PLAIN = { pages: 1, content: CONTENT, text: TEXT, title: TITLE, xmp: true };

/** The qpdf copies of source.pdf and the passwords that open each. */
const COPIES: readonly { file: string; passwords: readonly (string | undefined)[] }[] = [
  { file: 'rc4-40-r2.pdf', passwords: ['user', 'owner'] },
  { file: 'rc4-128-r3.pdf', passwords: ['user', 'owner'] },
  { file: 'aes-128-r4.pdf', passwords: ['user', 'owner'] },
  { file: 'aes-128-r4-nometa.pdf', passwords: ['user', 'owner'] },
  { file: 'aes-256-r6.pdf', passwords: ['user', 'owner'] },
  { file: 'load/rc4-40-r2.objstm.pdf', passwords: ['user', 'owner'] },
  { file: 'load/rc4-128-r3.objstm.pdf', passwords: ['user', 'owner'] },
  { file: 'load/rc4-128-r4.pdf', passwords: ['user', 'owner'] },
  { file: 'load/rc4-128-r4.objstm.pdf', passwords: ['user', 'owner'] },
  { file: 'load/aes-128-r4.objstm.pdf', passwords: ['user', 'owner'] },
  { file: 'load/aes-128-r4-nometa.objstm.pdf', passwords: ['user', 'owner'] },
  { file: 'load/aes-256-r6.objstm.pdf', passwords: ['user', 'owner'] },
  { file: 'load/aes-128-r4.empty.pdf', passwords: [undefined, '', 'owner'] },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('every object of an encrypted file is decrypted', () => {
  for (const { file, passwords } of COPIES) {
    for (const password of passwords) {
      it(`${file} with ${password === undefined ? 'no password' : `"${password}"`}`, async () => {
        const doc = await loadPdf(fixture(file), password === undefined ? {} : { password });
        expect(observe(doc)).toEqual(PLAIN);
      });
    }
  }

  it('objects keep their numbers: the Info dictionary is the trailer /Info object', async () => {
    // cons-r4-control.pdf numbers its objects 1 to 7; Info is object 6.
    const doc = await loadPdf(fixture('load/cons-r4-control.pdf'), { password: 'user' });
    const info = doc.getRegistry().resolve(PdfRef.of(6, 0)) as PdfDict;
    expect((info.get('/Title') as PdfString).toText()).toBe(TITLE);
  });

  /**
   * The object number of every decryption of a load: each one derives the object key of the
   * object it decrypts (through a private method of the handler).
   */
  function spyDecryptions(): { readonly calls: () => number[] } {
    const derive = vi.spyOn(
      PdfEncryptionHandler.prototype as unknown as {
        deriveObjectKey: (objNum: number, genNum: number, aes?: boolean) => Uint8Array;
      },
      'deriveObjectKey',
    );
    return { calls: () => derive.mock.calls.map((c) => c[0]) };
  }

  it('strings inside an object stream are not decrypted a second time', async () => {
    const decryptions = spyDecryptions();
    const doc = await loadPdf(fixture('load/aes-128-r4.objstm.pdf'), { password: 'user' });
    expect(doc.getTitle()).toBe(TITLE);
    // Every string of this file is in a dictionary, and qpdf puts every dictionary in the object
    // stream: only streams are decrypted (the object stream among them), each once.
    const numbers = decryptions.calls();
    expect(numbers.length).toBeGreaterThan(0);
    for (const num of numbers) {
      expect(doc.getRegistry().resolve(PdfRef.of(num, 0))?.kind, `object ${num}`).toBe('stream');
    }
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('a cross-reference stream is not decrypted', async () => {
    const decryptions = spyDecryptions();
    const doc = await loadPdf(fixture('load/aes-128-r4.objstm.pdf'), { password: 'user' });
    const xrefNumbers = findByType(doc, '/XRef').map((e) => e.ref.objectNumber);
    expect(xrefNumbers.length).toBeGreaterThan(0);
    for (const num of decryptions.calls()) expect(xrefNumbers).not.toContain(num);
  });

  it('the /Encrypt dictionary is not decrypted and not registered', async () => {
    const doc = await loadPdf(fixture('aes-128-r4.pdf'), { password: 'user' });
    for (const entry of doc.getRegistry()) {
      const dict = entry.object.kind === 'dict' ? (entry.object as PdfDict) : undefined;
      expect(dict?.get('/Filter')?.kind === 'name' && dict.has('/O')).toBe(false);
    }
  });
});

/**
 * A stream whose /Length is an integer in an object stream that the cross-reference stream lists
 * after it: the object stream is decrypted first, so the stream is framed by its /Length, never
 * by recovery (white space beyond one EOL before `endstream` would otherwise be decrypted with
 * the data).
 */
describe('object streams are decrypted before every other object', () => {
  const LENGTH_FILES = [
    'load/cons-r4-length-in-objstm.pdf',
    'load/cons-r4-length-in-objstm-2eol.pdf',
    'load/cons-r3-rc4-length-in-objstm-2eol.pdf',
  ] as const;

  for (const file of LENGTH_FILES) {
    for (const strict of [false, true]) {
      it(`${file}${strict ? ' with throwOnInvalidObject' : ''}: the content stream decrypts to its plaintext`, async () => {
        const doc = await loadPdf(fixture(file), {
          password: 'user',
          ...(strict ? { throwOnInvalidObject: true } : {}),
        });
        const stream = doc.getRegistry().resolve(PdfRef.of(4, 0)) as PdfStream;
        expect(latin1(stream.data)).toBe(CONTENT);
        expect(observe(doc).text).toBe(TEXT);
      });
    }

    it(`${file}: qpdf decrypts the content stream to the same bytes`, (ctx: TestContext) => {
      requireQpdf(ctx);
      expect(latin1(qpdfDecryptQdf(fixture(file), 'user'))).toContain(
        `stream\n${CONTENT}\nendstream`,
      );
    });
  }
});

describe('strings, Identity filters and stream /Crypt filters', () => {
  const BUILT = [
    'load/cons-r4-control.pdf',
    'load/cons-r4-stmf-identity.pdf',
    'load/cons-r4-strf-identity.pdf',
    'load/cons-r4-crypt-identity-stream.pdf',
  ];
  for (const file of BUILT) {
    it(`${file}: content, Title, Author and the catalog /Lang hex string`, async () => {
      const doc = await loadPdf(fixture(file), { password: 'user' });
      expect(observe(doc)).toMatchObject({ pages: 1, content: CONTENT, text: TEXT, title: TITLE });
      expect(doc.getAuthor()).toBe('Author (lit)');
      const catalog = doc.getRegistry().resolve(PdfRef.of(1, 0)) as PdfDict;
      const lang = catalog.get('/Lang') as PdfString;
      expect(lang.toText()).toBe('en-US');
      expect(lang.hex).toBe(true);
      const info = doc.getRegistry().resolve(PdfRef.of(6, 0)) as PdfDict;
      expect((info.get('/Author') as PdfString).hex).toBe(false);
    });
  }

  it('the /Crypt filter is consumed: the stream filter list no longer holds it', async () => {
    const doc = await loadPdf(fixture('load/cons-r4-crypt-identity-stream.pdf'), {
      password: 'user',
    });
    const content = doc.getRegistry().resolve(PdfRef.of(4, 0)) as PdfStream;
    const filter = content.dict.get('/Filter');
    const names = filter?.kind === 'array' ? filter.items : filter === undefined ? [] : [filter];
    expect(names.some((n) => n.kind === 'name' && n.value === '/Crypt')).toBe(false);
  });

  it('a Title of bytes 0x80 to 0x9F is decrypted byte for byte', async () => {
    const doc = await loadPdf(fixture('load/cons-r4-title-c1.pdf'), { password: 'user' });
    const info = doc.getRegistry().resolve(PdfRef.of(6, 0)) as PdfDict;
    const title = info.get('/Title') as PdfString;
    expect(Array.from(title.toBytes())).toEqual(Array.from({ length: 32 }, (_, i) => 0x80 + i));
    expect(title.hex).toBe(true);
  });

  it('a UTF-16BE Title is decrypted byte for byte', async () => {
    const doc = await loadPdf(fixture('load/cons-r4-title-utf16.pdf'), { password: 'user' });
    const info = doc.getRegistry().resolve(PdfRef.of(6, 0)) as PdfDict;
    const title = info.get('/Title') as PdfString;
    expect(Array.from(title.toBytes())).toEqual([0xfe, 0xff, 0x00, 0x41, 0x20, 0x14, 0x00, 0x95]);
  });

  it('the /Contents of a signature dictionary is left as it is; its other strings decrypt', async () => {
    const signed = await loadPdf(fixture('load/signed-aes-128.pdf'), { password: 'user' });
    const source = await loadPdf(
      new Uint8Array(readFileSync(join(DIR, '../corpus/qpdf-signed.pdf'))),
    );
    const sigOf = (doc: PdfDocument): PdfDict => findByType(doc, '/Sig')[0]!.object as PdfDict;
    const a = sigOf(signed);
    const b = sigOf(source);
    expect((a.get('/Contents') as PdfString).toBytes()).toEqual(
      (b.get('/Contents') as PdfString).toBytes(),
    );
    for (const [key, value] of b) {
      if (value.kind === 'string') {
        expect((a.get(key) as PdfString).toBytes(), key).toEqual((value as PdfString).toBytes());
      }
    }
  });
});

describe('/EncryptMetadata false leaves only the document-level metadata stream as stored', () => {
  const PAGE_XMP = '<x:xmpmeta xmlns:x="adobe:ns:meta/">page xmp</x:xmpmeta>';

  /** The data of the catalog's /Metadata stream and of the page's, decoded. */
  async function metadataOf(file: string): Promise<{ catalog: string; page: string }> {
    const doc = await loadPdf(fixture(file), { password: 'user' });
    const registry = doc.getRegistry();
    const streamOf = (holder: PdfDict): string => {
      const stream = registry.resolve(holder.get('/Metadata') as PdfRef) as PdfStream;
      return latin1(decodeStreamData(stream));
    };
    return {
      catalog: streamOf(findByType(doc, '/Catalog')[0]!.object as PdfDict),
      page: streamOf(findByType(doc, '/Page')[0]!.object as PdfDict),
    };
  }

  it('qpdf --cleartext-metadata: the catalog stream is as stored, the page stream is decrypted', async () => {
    const { catalog, page } = await metadataOf('load/sig-shapes-aes-128-r4-nometa.pdf');
    expect(catalog).toContain(TITLE);
    expect(page).toBe(PAGE_XMP);
  });

  it('every metadata stream encrypted: both decrypt', async () => {
    const { catalog, page } = await metadataOf('load/sig-shapes-aes-128-r4.pdf');
    expect(catalog).toContain(TITLE);
    expect(page).toBe(PAGE_XMP);
  });
});

describe('errors', () => {
  it('a missing password and a wrong one throw EncryptedPdfError', async () => {
    await expect(loadPdf(fixture('aes-128-r4.pdf'))).rejects.toThrow(
      /This PDF is encrypted and requires a password\./,
    );
    await expect(loadPdf(fixture('aes-128-r4.pdf'), { password: 'nope' })).rejects.toThrow(
      /Failed to decrypt PDF: the provided password is incorrect\./,
    );
    await expect(loadPdf(fixture('aes-128-r4.pdf'))).rejects.toBeInstanceOf(EncryptedPdfError);
  });

  it('a security handler other than /Standard is refused, not reported as a wrong password', async () => {
    const bytes = bytesOf(
      latin1(fixture('load/cons-r4-control.pdf')).replace('/Filter /Standard', '/Filter /Adobe.PS'),
    );
    await expect(loadPdf(bytes, { password: 'user' })).rejects.toBeInstanceOf(
      UnsupportedEncryptionError,
    );
  });

  it('a direct /Encrypt dictionary in the trailer is refused', async () => {
    const bytes = bytesOf(
      latin1(fixture('load/cons-r4-control.pdf')).replace(
        '/Encrypt 7 0 R',
        '/Encrypt << /Filter /Standard /V 4 /R 4 >>',
      ),
    );
    await expect(loadPdf(bytes, { password: 'user' })).rejects.toBeInstanceOf(
      UnsupportedEncryptionError,
    );
    await expect(loadPdf(bytes, { ignoreEncryption: true })).resolves.toBeDefined();
  });

  it('a trailer with /Encrypt rebuilt by the recovery scan is refused', async () => {
    const text = latin1(fixture('load/cons-r4-control.pdf'));
    const bytes = bytesOf(text.replace(/startxref\n\d+/, 'startxref\n9'));
    await expect(loadPdf(bytes, { password: 'user' })).rejects.toBeInstanceOf(
      UnsupportedEncryptionError,
    );
    await expect(loadPdf(bytes, { ignoreEncryption: true })).resolves.toBeDefined();
  });

  it('AES data too short to hold an IV and a block is refused, not returned as ciphertext', async () => {
    // The Info /Title of cons-r4-control.pdf, cut to 20 bytes.
    const text = latin1(fixture('load/cons-r4-control.pdf'));
    const bytes = bytesOf(
      text.replace(/\/Title <([0-9a-f]+)>/, (_, h: string) => `/Title <${h.slice(0, 40)}>`),
    );
    await expect(loadPdf(bytes, { password: 'user' })).rejects.toBeInstanceOf(
      UnsupportedEncryptionError,
    );
  });

  it('of two strings that cannot be decrypted, the first in the dictionary is reported', async () => {
    // The Info dictionary of cons-r4-control.pdf: /Title with its last byte changed (wrong
    // padding), then /Author as a one-byte hex string (too short), each of the same length in
    // the file, so no offset moves.
    const text = latin1(fixture('load/cons-r4-control.pdf'));
    const bytes = bytesOf(
      text
        .replace(
          /\/Title <([0-9a-f]+)>/,
          (_, h: string) => `/Title <${h.slice(0, -2)}${h.endsWith('00') ? 'ff' : '00'}>`,
        )
        .replace(
          /\/Author (\([^)]*\))/,
          (_, s: string) => `/Author <01${' '.repeat(s.length - 4)}>`,
        ),
    );
    expect(bytes.length).toBe(fixture('load/cons-r4-control.pdf').length);
    await expect(loadPdf(bytes, { password: 'user' })).rejects.toThrow(
      /object 6 0 cannot be decrypted \(wrong padding\)/,
    );
  });
});

describe('what a document decrypted on load can do', () => {
  const load = (): Promise<PdfDocument> => loadPdf(fixture('aes-128-r4.pdf'), { password: 'user' });

  it('save, saveAsStream, saveAsBlob and saveAsBase64 refuse to write it without encrypt()', async () => {
    const doc = await load();
    await expect(doc.save()).rejects.toBeInstanceOf(UnsupportedEncryptionError);
    expect(() => doc.saveAsStream()).toThrow(UnsupportedEncryptionError);
    await expect(doc.saveAsBlob()).rejects.toBeInstanceOf(UnsupportedEncryptionError);
    await expect(doc.saveAsBase64()).rejects.toBeInstanceOf(UnsupportedEncryptionError);
  });

  it('after encrypt() it saves encrypted, and the new password opens the plaintext', async () => {
    const doc = await load();
    await doc.encrypt({
      userPassword: 'new-user',
      ownerPassword: 'new-owner',
      algorithm: 'aes-256',
    });
    const saved = await doc.save();
    await expect(loadPdf(saved)).rejects.toThrow(/requires a password/);
    const again = await loadPdf(saved, { password: 'new-user' });
    expect(observe(again)).toEqual(PLAIN);
  });

  it('copy() resolves, and the copy refuses save() the same way', async () => {
    const clone = await (await load()).copy();
    expect(observe(clone)).toEqual(PLAIN);
    await expect(clone.save()).rejects.toBeInstanceOf(UnsupportedEncryptionError);
  });

  it('pages copied or merged into a new document make its save() refuse until encrypt()', async () => {
    const source = await load();
    const target = createPdf();
    await target.copyPages(source, [0]);
    await expect(target.save()).rejects.toBeInstanceOf(UnsupportedEncryptionError);
    await target.encrypt({ userPassword: 'u', ownerPassword: 'o' });
    const saved = await target.save();
    await expect(loadPdf(saved)).rejects.toThrow(/requires a password/);
    expect((await loadPdf(saved, { password: 'u' })).getPageCount()).toBe(1);

    const merged = await mergePdfs([await load()]);
    await expect(merged.save()).rejects.toBeInstanceOf(UnsupportedEncryptionError);
  });

  it('ignoreEncryption: true keeps saving the streams as loaded', async () => {
    const doc = await loadPdf(fixture('aes-128-r4.pdf'), { ignoreEncryption: true });
    await expect(doc.save()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('encrypt() and save() of the raw-DEFLATE 0.40.3 file writes zlib data', async () => {
    const legacy = new Uint8Array(readFileSync(join(DIR, '../legacy-0.40.3/encrypted-r4.pdf')));
    const doc = await loadPdf(legacy, { password: 'user-0403' });
    expect(doc.getTitle()).toBe('aes-128');
    await doc.encrypt({ userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-128' });
    const again = await loadPdf(await doc.save(), { password: 'u' });
    expect(extractText(parseContentStream(again.getPage(0).getContentStream()))).toContain(
      'Encrypted R4 page',
    );
    for (const entry of again.getRegistry()) {
      if (entry.object.kind !== 'stream') continue;
      const stream = entry.object as PdfStream;
      const filter = stream.dict.get('/Filter');
      if (filter?.kind === 'name' && filter.value === '/FlateDecode') {
        expect(stream.data[0], `object ${entry.ref.objectNumber}`).toBe(0x78);
      }
    }
  });
});
