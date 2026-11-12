/**
 * The bytes of /Contents are cut to the length the outer DER header states, so a CMS whose data
 * ends in 0x00 keeps those bytes and only the padding after it is dropped.
 *
 * The input is the legacy signed fixture with one unsigned attribute added to its SignerInfo. An
 * unsigned attribute lies outside the signed data, so the signature stays cryptographically valid.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { verifySignatures } from '../../../src/signature/signatureVerifier.js';
import { verifySignatureDetailed } from '../../../src/signature/detailedVerifier.js';
import { embedLtvData } from '../../../src/signature/ltvEmbed.js';

interface Node {
  tag: number;
  kids?: Node[];
  raw?: Uint8Array;
}

function kidsOf(node: Node | undefined): Node[] {
  if (!node?.kids) throw new Error('constructed node expected');
  return node.kids;
}

function parse(data: Uint8Array, offset: number): [Node, number] {
  const tag = data[offset] ?? 0;
  let at = offset + 1;
  let len = data[at++] ?? 0;
  if (len & 0x80) {
    const count = len & 0x7f;
    len = 0;
    for (let i = 0; i < count; i++) len = len * 256 + (data[at++] ?? 0);
  }
  const end = at + len;
  if (tag & 0x20) {
    const kids: Node[] = [];
    let next = at;
    while (next < end) {
      const [kid, kidEnd] = parse(data, next);
      kids.push(kid);
      next = kidEnd;
    }
    return [{ tag, kids }, end];
  }
  return [{ tag, raw: data.subarray(at, end) }, end];
}

function lengthBytes(length: number): number[] {
  if (length < 128) return [length];
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest & 255);
  return [0x80 | bytes.length, ...bytes];
}

function encode(node: Node): number[] {
  const body = node.kids ? node.kids.flatMap(encode) : Array.from(node.raw ?? []);
  return [node.tag, ...lengthBytes(body.length), ...body];
}

function indexOfBytes(data: Uint8Array, needle: Uint8Array, from = 0): number {
  for (let at = from; at + needle.length <= data.length; at++) {
    if (needle.every((byte, i) => data[at + i] === byte)) return at;
  }
  return -1;
}

const ascii = new TextEncoder();
const FIXTURE = new Uint8Array(
  readFileSync(new URL('../../fixtures/legacy-0.40.3/signed.pdf', import.meta.url)),
);
const hexStart = indexOfBytes(FIXTURE, ascii.encode('/Contents <')) + '/Contents <'.length;
const hexEnd = FIXTURE.indexOf(0x3e, hexStart);
const placeholder = new TextDecoder('ascii').decode(FIXTURE.subarray(hexStart, hexEnd));

/** The fixture with its CMS re-encoded, `extend` run on the parsed tree, and re-padded. */
function withContents(extend: (signerInfo: Node) => void): { pdf: Uint8Array; hex: string } {
  const [cms] = parse(Uint8Array.fromHex(placeholder), 0);
  const signedData = kidsOf(kidsOf(cms)[1])[0];
  const signerInfos = kidsOf(signedData).at(-1);
  const signerInfo = kidsOf(signerInfos)[0];
  if (!signerInfo) throw new Error('SignerInfo expected');
  extend(signerInfo);
  const hex = Uint8Array.from(encode(cms)).toHex();
  const padded = ascii.encode(hex + '0'.repeat(placeholder.length - hex.length));
  const pdf = new Uint8Array(FIXTURE.length);
  pdf.set(FIXTURE.subarray(0, hexStart));
  pdf.set(padded, hexStart);
  pdf.set(FIXTURE.subarray(hexEnd), hexEnd);
  return { pdf, hex };
}

/** An unsigned attribute whose last DER byte is 0x00 (a NULL value). */
const endsInZero = withContents((signerInfo) => {
  kidsOf(signerInfo).push({
    tag: 0xa1,
    kids: [
      {
        tag: 0x30,
        kids: [
          { tag: 0x06, raw: Uint8Array.of(0x2a, 0x03) },
          { tag: 0x31, kids: [{ tag: 0x05, raw: new Uint8Array(0) }] },
        ],
      },
    ],
  });
});

describe('/Contents ending in a zero byte', () => {
  it('builds the input: the CMS ends in 0x00 and the padding follows it', () => {
    expect(endsInZero.hex.endsWith('0500')).toBe(true);
    expect(placeholder.length).toBeGreaterThan(endsInZero.hex.length + 8);
  });

  it('verifySignatures reports the signature valid', async () => {
    const [signature, ...rest] = await verifySignatures(endsInZero.pdf);
    expect(rest).toHaveLength(0);
    expect(signature?.integrityValid).toBe(true);
    expect(signature?.valid).toBe(true);
  });

  it('verifySignatureDetailed reports the signature valid', async () => {
    const [signature, ...rest] = await verifySignatureDetailed(endsInZero.pdf);
    expect(rest).toHaveLength(0);
    expect(signature?.integrityValid).toBe(true);
    expect(signature?.valid).toBe(true);
  });

  it('embedLtvData adds the signer certificate', async () => {
    const options = { includeOcsp: false, includeCrl: false };
    const added = async (pdf: Uint8Array): Promise<number> => {
      const out = await embedLtvData(pdf, options);
      const tail = new TextDecoder('latin1').decode(out.subarray(pdf.length));
      const certs = /\/Certs\s*\[([^\]]*)\]/.exec(tail)?.[1] ?? '';
      return certs.split(/\s+R\s*/).filter((ref) => ref.trim() !== '').length;
    };
    const original = await added(FIXTURE);
    expect(original).toBeGreaterThan(0);
    expect(await added(endsInZero.pdf)).toBe(original);
  });

  it('keeps an input that is not valid not valid', async () => {
    // Change one byte inside the signed range: the digest no longer matches.
    const tampered = endsInZero.pdf.slice();
    tampered[7] = (tampered[7] ?? 0) ^ 0x01;
    const [signature] = await verifySignatures(tampered);
    expect(signature?.integrityValid).toBe(false);
    expect(signature?.valid).toBe(false);
    const [detailed] = await verifySignatureDetailed(tampered);
    expect(detailed?.valid).toBe(false);
  });
});

describe('/Contents padding', () => {
  it('still drops the padding after a CMS that does not end in zero', async () => {
    const [signature] = await verifySignatures(FIXTURE);
    expect(signature?.integrityValid).toBe(true);
    expect(signature?.valid).toBe(true);
  });
});
