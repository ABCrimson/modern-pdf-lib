/**
 * Crypt filter selection and the shape of AES data in PdfEncryptionHandler.
 *
 * ISO 32000-2:2020, 7.6.6 (crypt filters): /StmF and /StrF name the filter for streams and
 * strings; /Identity, and an absent /StmF or /StrF, pass the data through unchanged; /EFF names
 * the filter of embedded file streams and defaults to /StmF. Table 25: /CFM is /None, /V2 (RC4),
 * /AESV2 or /AESV3. 7.6.3: an AES string or stream is a 16-byte IV followed by whole blocks with
 * padding. A handler other than /Standard, a /V outside 1, 2, 4 and 5, an unknown /CFM, and a
 * filter name that names no /CF entry and is not /Identity are refused before any password is
 * tried, with UnsupportedEncryptionError; AES data that is not an IV and whole padded blocks is
 * refused with the same error and is never returned as it came.
 */
import { describe, expect, it } from 'vitest';
import {
  PdfEncryptionHandler,
  decryptStreamBytes,
  decryptStringBytes,
  embeddedFileFilterName,
} from '../../../src/crypto/encryptionHandler.js';
import { PdfDict, PdfName, PdfNumber } from '../../../src/core/pdfObjects.js';
import { UnsupportedEncryptionError } from '../../../src/errors.js';

const PASSWORDS = { userPassword: 'user', ownerPassword: 'owner' } as const;
const PLAIN = new TextEncoder().encode('Crypt filter text');

/** A crypt filter dictionary with the given /CFM. */
function cf(cfm: string): PdfDict {
  const d = new PdfDict();
  d.set('/CFM', PdfName.of(cfm));
  d.set('/Length', PdfNumber.of(16));
  return d;
}

/** An R4 AES-128 handler and its /Encrypt dictionary, which the tests then change. */
async function r4(): Promise<{ readonly writer: PdfEncryptionHandler; readonly dict: PdfDict }> {
  const writer = await PdfEncryptionHandler.create({ ...PASSWORDS, algorithm: 'aes-128' });
  return { writer, dict: writer.buildEncryptDict() };
}

const open = (dict: PdfDict, writer: PdfEncryptionHandler): Promise<PdfEncryptionHandler> =>
  PdfEncryptionHandler.fromEncryptDict(dict, writer.getFileId(), 'user');

describe('fromEncryptDict refuses what it cannot honour', () => {
  it('a /Filter other than /Standard, before the password is tried', async () => {
    const { writer, dict } = await r4();
    dict.set('/Filter', PdfName.of('Adobe.PubSec'));
    await expect(open(dict, writer)).rejects.toBeInstanceOf(UnsupportedEncryptionError);
  });

  it('a /V outside 1, 2, 4 and 5', async () => {
    const { writer, dict } = await r4();
    dict.set('/V', PdfNumber.of(3));
    await expect(open(dict, writer)).rejects.toBeInstanceOf(UnsupportedEncryptionError);
  });

  it('a /CFM other than /None, /V2, /AESV2 and /AESV3', async () => {
    const { writer, dict } = await r4();
    const cfs = new PdfDict();
    cfs.set('/StdCF', cf('Bogus'));
    dict.set('/CF', cfs);
    await expect(open(dict, writer)).rejects.toBeInstanceOf(UnsupportedEncryptionError);
  });

  it('a /StmF, /StrF or /EFF that names no /CF entry', async () => {
    for (const key of ['/StmF', '/StrF', '/EFF']) {
      const { writer, dict } = await r4();
      dict.set(key, PdfName.of('Missing'));
      await expect(open(dict, writer), key).rejects.toBeInstanceOf(UnsupportedEncryptionError);
    }
  });

  it('a stream /Crypt filter name that names no /CF entry', async () => {
    const { writer, dict } = await r4();
    const handler = await open(dict, writer);
    const cipher = await writer.encryptObject(4, 0, PLAIN);
    await expect(decryptStreamBytes(handler, 4, 0, cipher, '/Missing')).rejects.toBeInstanceOf(
      UnsupportedEncryptionError,
    );
  });
});

describe('crypt filter selection', () => {
  it('/StmF /Identity passes streams through and still decrypts strings', async () => {
    const { writer, dict } = await r4();
    dict.set('/StmF', PdfName.of('Identity'));
    const handler = await open(dict, writer);
    expect(await decryptStreamBytes(handler, 4, 0, PLAIN)).toEqual(PLAIN);
    const cipher = await writer.encryptObject(4, 0, PLAIN);
    expect(await decryptStringBytes(handler, 4, 0, cipher)).toEqual(PLAIN);
  });

  it('/StrF /Identity passes strings through and still decrypts streams', async () => {
    const { writer, dict } = await r4();
    dict.set('/StrF', PdfName.of('Identity'));
    const handler = await open(dict, writer);
    expect(await decryptStringBytes(handler, 6, 0, PLAIN)).toEqual(PLAIN);
    const cipher = await writer.encryptObject(6, 0, PLAIN);
    expect(await decryptStreamBytes(handler, 6, 0, cipher)).toEqual(PLAIN);
  });

  it('an absent /StmF and /StrF mean /Identity', async () => {
    const { writer, dict } = await r4();
    dict.delete('/StmF');
    dict.delete('/StrF');
    const handler = await open(dict, writer);
    expect(await decryptStreamBytes(handler, 4, 0, PLAIN)).toEqual(PLAIN);
    expect(await decryptStringBytes(handler, 4, 0, PLAIN)).toEqual(PLAIN);
  });

  it('/CFM /None passes the data through', async () => {
    const { writer, dict } = await r4();
    const cfs = new PdfDict();
    cfs.set('/StdCF', cf('None'));
    dict.set('/CF', cfs);
    const handler = await open(dict, writer);
    expect(await decryptStreamBytes(handler, 4, 0, PLAIN)).toEqual(PLAIN);
    expect(await decryptStringBytes(handler, 4, 0, PLAIN)).toEqual(PLAIN);
  });

  it('a stream /Crypt filter name selects its own filter', async () => {
    const { writer, dict } = await r4();
    const handler = await open(dict, writer);
    expect(await decryptStreamBytes(handler, 4, 0, PLAIN, '/Identity')).toEqual(PLAIN);
    const cipher = await writer.encryptObject(4, 0, PLAIN);
    expect(await decryptStreamBytes(handler, 4, 0, cipher, '/StdCF')).toEqual(PLAIN);
  });

  it('streams and strings use different methods when /StmF and /StrF name different filters', async () => {
    // An RC4 writer over the same file key: an R4 dictionary whose only filter is /V2.
    const { writer, dict } = await r4();
    const rc4Dict = writer.buildEncryptDict();
    const rc4Cfs = new PdfDict();
    rc4Cfs.set('/StdCF', cf('V2'));
    rc4Dict.set('/CF', rc4Cfs);
    const rc4 = await open(rc4Dict, writer);
    expect(rc4.isAes()).toBe(false);

    const cfs = new PdfDict();
    cfs.set('/A', cf('AESV2'));
    cfs.set('/R', cf('V2'));
    dict.set('/CF', cfs);
    dict.set('/StmF', PdfName.of('A'));
    dict.set('/StrF', PdfName.of('R'));
    const mixed = await open(dict, writer);
    expect(await decryptStreamBytes(mixed, 9, 0, await writer.encryptObject(9, 0, PLAIN))).toEqual(
      PLAIN,
    );
    expect(await decryptStringBytes(mixed, 9, 0, await rc4.encryptObject(9, 0, PLAIN))).toEqual(
      PLAIN,
    );
  });

  it('/EFF names the filter of embedded file streams, and defaults to /StmF', async () => {
    const { writer, dict } = await r4();
    expect(embeddedFileFilterName(await open(dict, writer))).toBe('/StdCF');
    dict.set('/EFF', PdfName.of('Identity'));
    expect(embeddedFileFilterName(await open(dict, writer))).toBe('/Identity');
  });
});

describe('AES data shape', () => {
  it('a 16-byte AES string or stream (the IV alone) decrypts to empty', async () => {
    const { writer, dict } = await r4();
    const handler = await open(dict, writer);
    const iv = new Uint8Array(16).fill(7);
    expect(await decryptStringBytes(handler, 1, 0, iv)).toEqual(new Uint8Array(0));
    expect(await decryptStreamBytes(handler, 1, 0, iv)).toEqual(new Uint8Array(0));
  });

  it('AES data that is not an IV and whole blocks is refused, never returned as it came', async () => {
    const { writer, dict } = await r4();
    const handler = await open(dict, writer);
    for (const length of [1, 15, 31, 33]) {
      const data = new Uint8Array(length).fill(9);
      await expect(decryptStringBytes(handler, 1, 0, data), `${length}`).rejects.toBeInstanceOf(
        UnsupportedEncryptionError,
      );
      await expect(handler.decryptObject(1, 0, data), `${length}`).rejects.toBeInstanceOf(
        UnsupportedEncryptionError,
      );
    }
  });

  it('AES data with wrong padding is refused', async () => {
    const { writer, dict } = await r4();
    const handler = await open(dict, writer);
    const cipher = await writer.encryptObject(1, 0, PLAIN);
    const damaged = cipher.slice();
    damaged[damaged.length - 1]! ^= 0xff;
    await expect(decryptStringBytes(handler, 1, 0, damaged)).rejects.toBeInstanceOf(
      UnsupportedEncryptionError,
    );
  });

  it('whole AES data still round-trips', async () => {
    const { writer, dict } = await r4();
    const handler = await open(dict, writer);
    const cipher = await writer.encryptObject(1, 0, PLAIN);
    expect(await decryptStringBytes(handler, 1, 0, cipher)).toEqual(PLAIN);
    expect(await handler.decryptObject(1, 0, cipher)).toEqual(PLAIN);
  });
});

describe('the declared surface of PdfEncryptionHandler', () => {
  // The members of the class as 0.40.8 declared them: crypt filters add module functions of
  // src/crypto/encryptionHandler.ts, not members of the class (a root export).
  const METHODS = [
    'constructor',
    'deriveObjectKey',
    'encryptObject',
    'decryptObject',
    'encryptString',
    'decryptStream',
    'buildEncryptDict',
    'getPermissions',
    'getPermissionsValue',
    'isAes',
    'getVersion',
    'getRevision',
    'getFileKey',
    'getFileId',
    'isMetadataEncrypted',
  ];
  const FIELDS = [
    'fileKey',
    'version',
    'revision',
    'keyLengthBits',
    'useAes',
    'encryptMetadata',
    'permissionsValue',
    'ownerKey',
    'userKey',
    'ownerEncryptionKey',
    'userEncryptionKey',
    'perms',
    'fileId',
    'objectKeyCache',
  ];

  it('has the methods, static methods and fields it had before', async () => {
    expect(Object.getOwnPropertyNames(PdfEncryptionHandler.prototype).sort()).toEqual(
      [...METHODS].sort(),
    );
    expect(
      Object.getOwnPropertyNames(PdfEncryptionHandler)
        .filter((n) => typeof Reflect.get(PdfEncryptionHandler, n) === 'function')
        .sort(),
    ).toEqual(['create', 'fromEncryptDict']);
    const { writer, dict } = await r4();
    expect(Object.keys(writer).sort()).toEqual([...FIELDS].sort());
    expect(Object.keys(await open(dict, writer)).sort()).toEqual([...FIELDS].sort());
  });
});
