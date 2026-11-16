/**
 * The DER reader of src/signature/cms/pkcs7.ts on constructed inputs, under the budgeted runner
 * (2 s, 512 MiB over the baseline): each ends in the asserted error, or completes with the right
 * result, and none is ended by the runner.
 */
import { describe, expect, it } from 'vitest';
import { INTERNAL_LIMITS } from '../../src/internal/limits.js';
import { findSignatures } from '../../src/signature/pades/byteRange.js';
import { signPdf } from '../../src/signature/pades/signatureHandler.js';
import { createMinimalPdf, generateTestCert } from '../helpers/signature-trust-fixtures.js';
import { DEFAULT_BUDGET, runWithinBudget, timeLimitMs } from '../helpers/budget.js';
import type { BudgetOutcome } from '../helpers/budget.js';

const BODIES = 'tests/adversarial/der-limits.bodies.ts';
// Start-up (child process, worker, tsx import of the body module) comes before the budget clock.
const TIMEOUT = 30_000;

const run = (
  entry: string,
  input: Uint8Array,
  args?: Parameters<typeof runWithinBudget>[0]['args'],
) => runWithinBudget({ module: BODIES, entry, input, ...(args === undefined ? {} : { args }) });

function expectParseError(outcome: BudgetOutcome, message: string): void {
  expect(outcome).toMatchObject({
    kind: 'threw',
    name: 'MalformedInputError',
    code: 'malformed-input',
    message,
  });
  expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
  expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
}

/** `levels` nested SEQUENCEs around an OCTET STRING that does not end in a zero byte. */
function nestedContents(levels: number): Uint8Array {
  let der = Uint8Array.of(0x04, 0x01, 0x09);
  for (let i = 0; i < levels; i++) {
    const out = new Uint8Array(der.length + 4);
    out.set([0x30, 0x82, der.length >> 8, der.length & 0xff], 0);
    out.set(der, 4);
    der = out;
  }
  return der;
}

/**
 * A PDF whose first signature has its /Contents replaced by `contents`, followed by a good
 * signature that covers the whole file.
 */
async function firstReplacedThenSigned(contents: Uint8Array): Promise<Uint8Array> {
  const refused = await generateTestCert('Refused Signer');
  const good = await generateTestCert('Good Signer');
  const once = await signPdf(createMinimalPdf(), 'FirstSig', {
    certificate: refused.certificate,
    privateKey: refused.privateKey,
  });
  const [only] = findSignatures(once);
  const replaced = once.slice();
  replaced.set(
    new TextEncoder().encode(contents.toHex().padEnd(only!.contentsHex.length, '0')),
    only!.contentsOffset + 1,
  );
  return signPdf(replaced, 'SecondSig', {
    certificate: good.certificate,
    privateKey: good.privateKey,
  });
}

describe('der limits', () => {
  it(
    'refuses a 4-byte length that runs past the data',
    async () => {
      const outcome = await run(
        'parse',
        Uint8Array.of(0x30, 0x06, 0x30, 0x84, 0xff, 0xff, 0xff, 0xfa),
      );
      expectParseError(outcome, 'DER: length runs past the end of the data');
    },
    TIMEOUT,
  );

  it(
    'refuses a 4-byte length with the high bit set inside a context tag',
    async () => {
      const outcome = await run(
        'parse',
        Uint8Array.of(0x30, 0x06, 0xa0, 0x84, 0x80, 0x00, 0x00, 0x00),
      );
      expectParseError(outcome, 'DER: length runs past the end of the data');
    },
    TIMEOUT,
  );

  it(
    'refuses an indefinite length',
    async () => {
      const outcome = await run('parse', Uint8Array.of(0x30, 0x80, 0x04, 0x01, 0x09, 0x00, 0x00));
      expectParseError(outcome, 'DER: indefinite length is not supported');
    },
    TIMEOUT,
  );

  it(
    'refuses more than 4 length bytes',
    async () => {
      const outcome = await run(
        'parse',
        Uint8Array.of(0x04, 0x88, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01),
      );
      expectParseError(outcome, 'DER: more than 4 length bytes');
    },
    TIMEOUT,
  );

  it(
    'throws ResourceLimitError above the DER depth limit for 200000 nested values',
    async () => {
      const outcome = await run('parseNested', new Uint8Array(0), { levels: 200_000 });
      expect(outcome).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        code: 'resource-limit-exceeded',
        limit: 'maxDerDepth',
        message: `Input exceeds the internal limit maxDerDepth (${INTERNAL_LIMITS.maxDerDepth} levels).`,
      });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
    },
    TIMEOUT,
  );

  it(
    `throws ResourceLimitError for ${INTERNAL_LIMITS.maxDerDepth + 1} nested values and reads ${INTERNAL_LIMITS.maxDerDepth}`,
    async () => {
      const over = await run('parseNested', new Uint8Array(0), {
        levels: INTERNAL_LIMITS.maxDerDepth + 1,
      });
      expect(over).toMatchObject({
        kind: 'threw',
        name: 'ResourceLimitError',
        limit: 'maxDerDepth',
      });
      const at = await run('parseNested', new Uint8Array(0), {
        levels: INTERNAL_LIMITS.maxDerDepth,
      });
      expect(at).toMatchObject({
        kind: 'completed',
        result: { levels: INTERNAL_LIMITS.maxDerDepth },
      });
    },
    TIMEOUT,
  );

  it(
    'reads a 64 MiB value whose length fits in the data',
    async () => {
      const outcome = await run('parseLarge', new Uint8Array(0), { size: 64 * 1024 * 1024 });
      expect(outcome).toMatchObject({ kind: 'completed', result: { length: 64 * 1024 * 1024 } });
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
    },
    TIMEOUT,
  );

  it(
    'reads a small constructed value',
    async () => {
      const outcome = await run('parse', Uint8Array.of(0x30, 0x03, 0x04, 0x01, 0x09));
      expect(outcome).toMatchObject({
        kind: 'completed',
        result: { tag: 0x30, children: 1, totalLength: 5 },
      });
    },
    TIMEOUT,
  );

  for (const [title, contents] of [
    ['nesting above the depth limit', () => nestedContents(INTERNAL_LIMITS.maxDerDepth * 2)],
    [
      'a length that runs past the data',
      () => Uint8Array.of(0x30, 0x06, 0x30, 0x84, 0xff, 0xff, 0xff, 0xfa),
    ],
  ] as const) {
    it(
      `verifySignatures reports ${title} as an unparsable signature and verifies the other one`,
      async () => {
        const [refusedDoc, unparsableDoc] = await Promise.all([
          firstReplacedThenSigned(contents()),
          firstReplacedThenSigned(Uint8Array.of(0x01, 0x02, 0x03)),
        ]);
        const outcome = await run('verifyDocument', refusedDoc);
        const reference = await run('verifyDocument', unparsableDoc);
        expect(outcome.kind).toBe('completed');
        expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
        expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
        const results = (outcome as Extract<BudgetOutcome, { kind: 'completed' }>).result as Array<
          Record<string, unknown>
        >;
        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({
          signedBy: 'Unknown',
          valid: false,
          integrityValid: false,
        });
        expect(results[1]).toMatchObject({ signedBy: 'Good Signer', valid: true });
        expect(reference).toMatchObject({ kind: 'completed', result: results });
      },
      TIMEOUT,
    );
  }

  it(
    'verifySignatures reads a /Contents of 400000 zero digits followed by 01',
    async () => {
      const pdf = new TextEncoder().encode(
        `%PDF-1.7\n1 0 obj\n<</Type /Sig /ByteRange [0 10 20 30] /Contents <${'00'.repeat(200_000)}01>>>\nendobj\n%%EOF\n`,
      );
      const outcome = await run('verifyDocument', pdf);
      expect(outcome.kind).toBe('completed');
      expect(outcome.ms).toBeLessThan(timeLimitMs(DEFAULT_BUDGET));
      expect(outcome.mib).toBeLessThan(DEFAULT_BUDGET.mib);
      const results = (outcome as Extract<BudgetOutcome, { kind: 'completed' }>).result as Array<
        Record<string, unknown>
      >;
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ valid: false });
    },
    TIMEOUT,
  );
});
