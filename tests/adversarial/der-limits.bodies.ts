/**
 * Entries for tests/adversarial/der-limits.test.ts: the DER reader of src/signature/cms/pkcs7.ts on
 * inputs built in code. The runner loads this module in a worker and calls one named export.
 */
import type { JsonValue } from '../helpers/budget.js';
import { parseDerTlv } from '../../src/signature/cms/pkcs7.js';
import { verifySignatures } from '../../src/signature/pades/signatureVerifier.js';

/** Reads the input as one DER value and returns its tag and its number of children. */
export function parse(bytes: Uint8Array, _args: JsonValue): JsonValue {
  const node = parseDerTlv(bytes, 0);
  return { tag: node.tag, children: node.children.length, totalLength: node.totalLength };
}

/** The DER of `levels` nested SEQUENCEs around a one-byte OCTET STRING, written front to back. */
function nested(levels: number): Uint8Array {
  const leaf = Uint8Array.of(0x04, 0x01, 0x09);
  const total = levels * 6 + leaf.length;
  const out = new Uint8Array(total);
  for (let i = 0; i < levels; i++) {
    // Each level is 0x30, 0x84 and a 4-byte length: everything after its own header.
    const length = total - 6 * (i + 1);
    out.set(
      [
        0x30,
        0x84,
        (length >>> 24) & 0xff,
        (length >>> 16) & 0xff,
        (length >>> 8) & 0xff,
        length & 0xff,
      ],
      6 * i,
    );
  }
  out.set(leaf, levels * 6);
  return out;
}

/** Reads `args.levels` nested SEQUENCEs built in the worker and returns the levels it counted. */
export function parseNested(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const levels = (args as { levels: number }).levels;
  const node = parseDerTlv(nested(levels), 0);
  let counted = 1;
  for (let n = node; n.children[0]?.constructed; n = n.children[0]) counted++;
  return { levels: counted };
}

/** Reads one OCTET STRING of `args.size` bytes built in the worker and returns its content length. */
export function parseLarge(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const size = (args as { size: number }).size;
  const header = Uint8Array.of(
    0x04,
    0x84,
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
  );
  const der = new Uint8Array(header.length + size);
  der.set(header, 0);
  return { length: parseDerTlv(der, 0).data.length };
}

/**
 * Runs `verifySignatures` on the input, a PDF whose signatures are all listed in the result, and
 * returns what each result says (the fields as plain values; absent ones are left out).
 */
export async function verifyDocument(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  const results = await verifySignatures(bytes);
  return results.map((r) => ({
    signedBy: r.signedBy,
    valid: r.valid,
    integrityValid: r.integrityValid,
    coversWholeDocument: r.coversWholeDocument,
    ...(r.certificateValid === undefined ? {} : { certificateValid: r.certificateValid }),
    ...(r.reason === undefined ? {} : { reason: r.reason }),
  }));
}
