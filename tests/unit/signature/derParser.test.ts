/**
 * Tests for the DER reader `parseDerTlv` (src/signature/cms/pkcs7.ts): the length rules, the depth
 * limit, a reference comparison on real certificates, and the verifiers' handling of a signature
 * whose bytes break a rule (it is reported exactly like an unparsable signature, its reason stays
 * the signing reason, and only verifySignatureDetailed names the refusal in errors).
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { INTERNAL_LIMITS } from '../../../src/internal/limits.js';
import { ResourceLimitError } from '../../../src/errors.js';
import { findSignatures } from '../../../src/signature/pades/byteRange.js';
import { verifySignatureDetailed } from '../../../src/signature/pades/detailedVerifier.js';
import { parseDerTlv } from '../../../src/signature/cms/pkcs7.js';
import type { Asn1Node } from '../../../src/signature/cms/pkcs7.js';
import { signPdf } from '../../../src/signature/pades/signatureHandler.js';
import { verifySignatures } from '../../../src/signature/pades/signatureVerifier.js';
import {
  buildTestCrl,
  buildTestCertificate,
  createMinimalPdf,
  generateRootCA,
  generateLeafCert,
  generateTestCert,
} from '../../helpers/signature-trust-fixtures.js';

/** `leaf` wrapped in `levels` SEQUENCEs. */
function wrap(leaf: Uint8Array, levels: number): Uint8Array {
  let der = leaf;
  for (let i = 0; i < levels; i++) {
    const length = der.length;
    const header =
      length < 0x80
        ? [0x30, length]
        : length <= 0xff
          ? [0x30, 0x81, length]
          : length <= 0xffff
            ? [0x30, 0x82, length >> 8, length & 0xff]
            : [0x30, 0x83, length >> 16, (length >> 8) & 0xff, length & 0xff];
    const next = new Uint8Array(header.length + length);
    next.set(header, 0);
    next.set(der, header.length);
    der = next;
  }
  return der;
}

/** The DER of `levels` nested SEQUENCEs, the innermost empty. */
function nestedSequences(levels: number): Uint8Array {
  return wrap(Uint8Array.of(0x30, 0x00), levels - 1);
}

/**
 * The reader as it was before the length rules: the same tree for every well-formed input, kept
 * here as the reference for the comparison on real certificates.
 */
function referenceParse(data: Uint8Array, offset: number): Asn1Node {
  const tag = data[offset]!;
  const constructed = !!(tag & 0x20);
  let pos = offset + 1;
  let length: number;
  const first = data[pos]!;
  pos++;
  if (first < 0x80) {
    length = first;
  } else {
    length = 0;
    for (let i = 0; i < (first & 0x7f); i++) {
      length = (length << 8) | data[pos]!;
      pos++;
    }
  }
  const headerLength = pos - offset;
  const nodeData = data.subarray(pos, pos + length);
  const children: Asn1Node[] = [];
  if (constructed) {
    let childOffset = 0;
    while (childOffset < nodeData.length) {
      const child = referenceParse(nodeData, childOffset);
      children.push(child);
      childOffset += child.totalLength;
    }
  }
  return {
    tag,
    constructed,
    data: nodeData,
    children,
    offset,
    headerLength,
    totalLength: headerLength + length,
  };
}

/** The tree as plain values, with the content bytes as hex. */
function plain(node: Asn1Node): unknown {
  return {
    tag: node.tag,
    constructed: node.constructed,
    data: node.data.toHex(),
    offset: node.offset,
    headerLength: node.headerLength,
    totalLength: node.totalLength,
    children: node.children.map(plain),
  };
}

describe('parseDerTlv length rules', () => {
  it('reads a short-form length', () => {
    const node = parseDerTlv(Uint8Array.of(0x04, 0x02, 0xaa, 0xbb), 0);
    expect(node.tag).toBe(0x04);
    expect(node.data).toEqual(Uint8Array.of(0xaa, 0xbb));
    expect(node.headerLength).toBe(2);
    expect(node.totalLength).toBe(4);
  });

  it('reads long-form lengths of 1 to 4 bytes', () => {
    const cases: Array<[number[], number]> = [
      [[0x81, 0x80], 0x80],
      [[0x82, 0x01, 0x00], 0x100],
      [[0x83, 0x00, 0x01, 0x00], 0x100],
      [[0x84, 0x00, 0x00, 0x01, 0x00], 0x100],
    ];
    for (const [lengthBytes, size] of cases) {
      const der = new Uint8Array(1 + lengthBytes.length + size);
      der[0] = 0x04;
      der.set(lengthBytes, 1);
      const node = parseDerTlv(der, 0);
      expect(node.data.length).toBe(size);
      expect(node.headerLength).toBe(1 + lengthBytes.length);
      expect(node.totalLength).toBe(der.length);
    }
  });

  it('reads a value from an offset inside a larger buffer', () => {
    const node = parseDerTlv(Uint8Array.of(0xff, 0xff, 0x04, 0x01, 0x07), 2);
    expect(node.offset).toBe(2);
    expect(node.data).toEqual(Uint8Array.of(0x07));
  });

  it('refuses an offset at or past the end of the data', () => {
    expect(() => parseDerTlv(new Uint8Array(0), 0)).toThrow('Unexpected end of DER data');
    expect(() => parseDerTlv(Uint8Array.of(0x04, 0x00), 2)).toThrow('Unexpected end of DER data');
  });

  it('refuses a tag with no length byte', () => {
    expect(() => parseDerTlv(Uint8Array.of(0x30), 0)).toThrow('Unexpected end of DER data');
  });

  it('refuses length bytes that run past the data', () => {
    expect(() => parseDerTlv(Uint8Array.of(0x30, 0x84, 0x01, 0x02), 0)).toThrow(
      'DER: length bytes run past the end of the data',
    );
    expect(() => parseDerTlv(Uint8Array.of(0x04, 0x81), 0)).toThrow(
      'DER: length bytes run past the end of the data',
    );
  });

  it('refuses an indefinite length', () => {
    expect(() => parseDerTlv(Uint8Array.of(0x30, 0x80, 0x00, 0x00), 0)).toThrow(
      'DER: indefinite length is not supported',
    );
  });

  it('refuses more than 4 length bytes', () => {
    expect(() => parseDerTlv(Uint8Array.of(0x04, 0x85, 0, 0, 0, 0, 1, 0xaa), 0)).toThrow(
      'DER: more than 4 length bytes',
    );
    expect(() => parseDerTlv(Uint8Array.of(0x04, 0xff), 0)).toThrow(
      'DER: more than 4 length bytes',
    );
  });

  it('refuses a length that runs past the data', () => {
    expect(() => parseDerTlv(Uint8Array.of(0x04, 0x05, 0xaa), 0)).toThrow(
      'DER: length runs past the end of the data',
    );
    // 0xFFFFFFFA: the largest 4-byte lengths are values, not negative numbers.
    expect(() => parseDerTlv(Uint8Array.of(0x30, 0x84, 0xff, 0xff, 0xff, 0xfa), 0)).toThrow(
      'DER: length runs past the end of the data',
    );
  });

  it('refuses a length that runs past the data of the enclosing value', () => {
    expect(() =>
      parseDerTlv(Uint8Array.of(0x30, 0x06, 0x30, 0x84, 0xff, 0xff, 0xff, 0xfa), 0),
    ).toThrow('DER: length runs past the end of the data');
    expect(() => parseDerTlv(Uint8Array.of(0x30, 0x03, 0x04, 0x05, 0xaa, 0xbb), 0)).toThrow(
      'DER: length runs past the end of the data',
    );
  });
});

describe('parseDerTlv depth limit', () => {
  it('reads nested constructed values up to the DER depth limit', () => {
    const node = parseDerTlv(nestedSequences(INTERNAL_LIMITS.maxDerDepth), 0);
    let levels = 1;
    for (let n = node; n.children.length > 0; n = n.children[0]!) levels++;
    expect(levels).toBe(INTERNAL_LIMITS.maxDerDepth);
  });

  it('throws ResourceLimitError above the DER depth limit', () => {
    const der = nestedSequences(INTERNAL_LIMITS.maxDerDepth + 1);
    let thrown: unknown;
    try {
      parseDerTlv(der, 0);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ResourceLimitError);
    expect(thrown).toMatchObject({
      code: 'resource-limit-exceeded',
      limit: 'maxDerDepth',
      max: INTERNAL_LIMITS.maxDerDepth,
      message: `Input exceeds the internal limit maxDerDepth (${INTERNAL_LIMITS.maxDerDepth} levels).`,
    });
  });

  it('counts constructed values only: a primitive inside the deepest level is read', () => {
    const der = wrap(Uint8Array.of(0x04, 0x01, 0x09), INTERNAL_LIMITS.maxDerDepth);
    let node = parseDerTlv(der, 0);
    for (let i = 1; i < INTERNAL_LIMITS.maxDerDepth; i++) node = node.children[0]!;
    expect(node.children[0]!.data).toEqual(Uint8Array.of(0x09));
  });

  it('throws ResourceLimitError for a deep input without overflowing the stack', () => {
    expect(() => parseDerTlv(nestedSequences(100_000), 0)).toThrow(ResourceLimitError);
  });
});

describe('parseDerTlv on real certificates', () => {
  it('parses to the same tree as the reference reader', async () => {
    const { certificate: root, keyPair } = await generateRootCA('Der Root');
    const leaf = await generateLeafCert('Der Leaf', root, keyPair);
    const { certificate: signer } = await generateTestCert('Der Signer');
    const inputs: Uint8Array[] = [
      root,
      leaf,
      signer,
      buildTestCertificate(Uint8Array.of(0x01, 0x02), 'Der Placeholder'),
      buildTestCrl('Der Root', [Uint8Array.of(0x05)]),
    ];
    for (const der of inputs) {
      expect(plain(parseDerTlv(der, 0))).toEqual(plain(referenceParse(der, 0)));
    }
  });
});

describe('verifiers and DER failures', () => {
  /**
   * A PDF signed twice: the first signature has its /Contents replaced by
   * `contents`, then the second signature, which covers the whole file, is added by a good signer.
   */
  async function firstReplacedThenSigned(contents: Uint8Array): Promise<Uint8Array> {
    const refused = await generateTestCert('Refused Signer');
    const good = await generateTestCert('Good Signer');
    const once = await signPdf(createMinimalPdf(), 'FirstSig', {
      certificate: refused.certificate,
      privateKey: refused.privateKey,
    });
    const [only] = findSignatures(once);
    // contentsOffset is the position of the opening `<`; the placeholder is zero-padded hex.
    const hexLength = only!.contentsHex.length;
    expect(contents.length * 2).toBeLessThanOrEqual(hexLength);
    const replaced = once.slice();
    replaced.set(
      new TextEncoder().encode(contents.toHex().padEnd(hexLength, '0')),
      only!.contentsOffset + 1,
    );
    // signPdf writes no /Reason: overwrite the first dictionary's /SubFilter entry with one, so a
    // refused signature has a signing reason that a regression could drop.
    const subFilter = '/SubFilter /adbe.pkcs7.detached';
    const at = new TextDecoder('latin1')
      .decode(replaced)
      .lastIndexOf('/SubFilter', only!.contentsOffset);
    expect(new TextDecoder('latin1').decode(replaced.subarray(at, at + subFilter.length))).toBe(
      subFilter,
    );
    replaced.set(new TextEncoder().encode('/Reason (Approval)'.padEnd(subFilter.length, ' ')), at);
    const twice = await signPdf(replaced, 'SecondSig', {
      certificate: good.certificate,
      privateKey: good.privateKey,
    });
    expect(findSignatures(twice).length).toBe(2);
    return twice;
  }

  const hostile: Array<[string, () => Uint8Array, string]> = [
    [
      'a length that runs past the data',
      () => Uint8Array.of(0x30, 0x06, 0x30, 0x84, 0xff, 0xff, 0xff, 0xfa),
      'DER: length runs past the end of the data',
    ],
    [
      'an indefinite length',
      () => Uint8Array.of(0x30, 0x80, 0x04, 0x01, 0x00, 0x00, 0x00),
      'DER: indefinite length is not supported',
    ],
    [
      'nesting above the DER depth limit',
      // The leaf does not end in a zero byte: the verifiers trim trailing zeros of /Contents.
      () => wrap(Uint8Array.of(0x04, 0x01, 0x09), INTERNAL_LIMITS.maxDerDepth + 1),
      `Input exceeds the internal limit maxDerDepth (${INTERNAL_LIMITS.maxDerDepth} levels).`,
    ],
  ];

  for (const [title, build, message] of hostile) {
    it(`verifySignatures reports ${title} as not valid and still returns the other signature`, async () => {
      const results = await verifySignatures(await firstReplacedThenSigned(build()));
      expect(results).toHaveLength(2);
      const [bad, good] = results as [(typeof results)[number], (typeof results)[number]];
      // The same slot filled with bytes that are not DER at all: the result of an unparsable signature.
      const [unparsable] = await verifySignatures(
        await firstReplacedThenSigned(Uint8Array.of(0x01, 0x02, 0x03)),
      );
      expect(good.signedBy).toBe('Good Signer');
      expect(good.valid).toBe(true);
      expect(good.integrityValid).toBe(true);
      expect(good.certificateValid).toBe(true);
      expect(bad.valid).toBe(false);
      expect(bad.integrityValid).toBe(false);
      expect(bad.signedBy).toBe('Unknown');
      expect(bad).toEqual(unparsable);
      expect(bad.reason).toBe('Approval');
      expect(JSON.stringify(bad)).not.toContain(message);
    });

    it(`verifySignatureDetailed reports ${title} as not valid and still returns the other signature`, async () => {
      const results = await verifySignatureDetailed(await firstReplacedThenSigned(build()));
      expect(results).toHaveLength(2);
      const [bad, good] = results as [(typeof results)[number], (typeof results)[number]];
      expect(good.signedBy).toBe('Good Signer');
      expect(good.cryptoValid).toBe(true);
      expect(bad.valid).toBe(false);
      expect(bad.errors).toEqual([`Failed to parse PKCS#7 signature structure: ${message}`]);
    });
  }
});

describe('hexToBytes in the four signature modules', () => {
  /** The trimming rules the modules had before the backward scan, written with the regex. */
  const references: Record<string, (hex: string) => Uint8Array> = {
    'pades/signatureVerifier.ts': (hex) => {
      let clean = hex.replace(/\s/g, '');
      if (clean.length % 2 !== 0) clean = '0' + clean;
      let endIdx = clean.length;
      const m = clean.match(/(00)+$/);
      if (m && m[0].length > 4) {
        endIdx = clean.length - m[0].length;
        if (endIdx < 2) endIdx = clean.length;
      }
      return Uint8Array.fromHex(clean.slice(0, endIdx));
    },
    'pades/detailedVerifier.ts': (hex) => {
      let clean = hex.replace(/\s/g, '');
      if (clean.length % 2 !== 0) clean = '0' + clean;
      const m = clean.match(/(00)+$/);
      if (m && m[0].length > 4) {
        let endIdx = clean.length - m[0].length;
        if (endIdx < 2) endIdx = clean.length;
        clean = clean.slice(0, endIdx);
      }
      return Uint8Array.fromHex(clean);
    },
    'cms/counterSignature.ts': (hex) => {
      let clean = hex.replace(/\s/g, '');
      const m = clean.match(/(00)+$/);
      if (m && m[0].length > 4) {
        const endIdx = clean.length - m[0].length;
        if (endIdx > 0 && endIdx % 2 === 0) clean = clean.slice(0, endIdx);
      }
      if (clean.length % 2 !== 0) clean = '0' + clean;
      return Uint8Array.fromHex(clean);
    },
    'ltv/ltvEmbed.ts': (hex) => references['cms/counterSignature.ts']!(hex),
  };

  /**
   * The module's own hexToBytes, compiled from its source text (the function is not exported). The
   * cut to the outer DER length is switched off here (`cutToOuterTlv` finds no header), so the
   * trimming that applies when the header cannot be read is what is compared; the cut itself is
   * tested in signatureTrailingZero.test.ts.
   */
  function load(file: string): (hex: string) => Uint8Array {
    const source = readFileSync(new URL(`../../../src/signature/${file}`, import.meta.url), 'utf8');
    const start = source.indexOf('function hexToBytes(hex: string): Uint8Array {');
    const end = source.indexOf('\n}\n', start);
    expect(start).toBeGreaterThan(-1);
    const js = source.slice(start, end + 2).replace('(hex: string): Uint8Array', '(hex)');
    const noHeader = (): undefined => undefined;
    return runInNewContext(`${js}\nhexToBytes;`, {
      Uint8Array,
      cutToOuterTlv: noHeader,
    }) as (hex: string) => Uint8Array;
  }

  /** Strings of 0 and 1 of every length up to 10 (spaces of the alphabet are removed before yielding), plus long zero runs, some with a space before the last digit. */
  function* samples(): Generator<string> {
    const alphabet = ['0', '1', ' '];
    let level = [''];
    for (let len = 0; len <= 10; len++) {
      for (const base of level) yield base.replace(/ /g, '');
      level = len < 10 ? level.flatMap((p) => alphabet.map((c) => p + c)) : [];
    }
    for (const zeros of [4, 5, 6, 7, 8, 9, 64, 65, 1000]) {
      yield `ab${'0'.repeat(zeros)}`;
      yield `ab${'0'.repeat(zeros)}1`;
      yield '0'.repeat(zeros);
      yield `1${'0'.repeat(zeros)}`;
      yield `a${'00'.repeat(zeros)} 0`;
    }
  }

  for (const [file, reference] of Object.entries(references)) {
    it(`${file} gives the result of the regex version`, () => {
      const actual = load(file);
      let compared = 0;
      for (const hex of samples()) {
        const clean = hex.replace(/\s/g, '');
        // Both sides read the same string; an odd length or a lone 0 is fine, fromHex needs hex digits.
        if (!/^[0-9a-f]*$/.test(clean)) continue;
        expect(actual(hex), `${file} on ${JSON.stringify(hex)}`).toEqual(reference(hex));
        compared++;
      }
      expect(compared).toBeGreaterThan(1000);
    });
  }
});
