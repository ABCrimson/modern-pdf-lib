/**
 * Signature entries that accept an option and do not act on it warn once per option with the
 * code `MPL_IGNORED_OPTION`: `signPdf`, `setCertificationLevel`, `addFieldLock`,
 * `verifySignatureDetailed` and `validateCertificateChain`. Each row checks the first call, the
 * second call, the absent and undefined option, and that the message names no caller value.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPdf } from '../../../src/index.js';
import { signPdf } from '../../../src/signature/pades/signatureHandler.js';
import { addFieldLock } from '../../../src/signature/pades/fieldLock.js';
import { MdpPermission, setCertificationLevel } from '../../../src/signature/pades/mdpPolicy.js';
import { verifySignatureDetailed } from '../../../src/signature/pades/detailedVerifier.js';
import { validateCertificateChain } from '../../../src/signature/pki/chainValidator.js';
import type { SignOptions } from '../../../src/signature/pades/signatureHandler.js';
import { resetWarningsForTesting } from '../../../src/internal/warnings.js';
import { generateTestCert } from '../../helpers/signature-trust-fixtures.js';

const TYPE = 'ModernPdfLibWarning';
const CODE = 'MPL_IGNORED_OPTION';
const latin1 = new TextDecoder('latin1');

let pdf: Uint8Array;
let signer: { certificate: Uint8Array; privateKey: Uint8Array };

beforeAll(async () => {
  const doc = createPdf();
  doc.addPage();
  pdf = await doc.save();
  signer = await generateTestCert('Warning Signer');
});

let emit: MockInstance<typeof process.emitWarning>;

beforeEach(() => {
  resetWarningsForTesting();
  emit = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWarningsForTesting();
});

interface Row {
  readonly entry: string;
  readonly option: string;
  /** The value passed to trigger the warning. */
  readonly value: unknown;
  /** Values that change nothing and must not warn. */
  readonly quiet?: readonly unknown[];
  readonly invoke: (extra: Record<string, unknown>) => Promise<unknown>;
}

const sign = (extra: Record<string, unknown>): Promise<unknown> =>
  signPdf(pdf, 'Signature1', { ...signer, ...extra } as SignOptions);

const ROWS: readonly Row[] = [
  {
    entry: 'signPdf',
    option: 'timestampUrl',
    value: 'http://tsa.invalid/SECRET-URL',
    invoke: sign,
  },
  { entry: 'signPdf', option: 'reason', value: 'SECRET-REASON', invoke: sign },
  { entry: 'signPdf', option: 'location', value: 'SECRET-LOCATION', invoke: sign },
  { entry: 'signPdf', option: 'contactInfo', value: 'SECRET-CONTACT', invoke: sign },
  {
    entry: 'verifySignatureDetailed',
    option: 'timeout',
    value: 987_654,
    invoke: (extra) => verifySignatureDetailed(pdf, extra),
  },
  {
    entry: 'verifySignatureDetailed',
    option: 'trustedCerts',
    value: [new Uint8Array(1)],
    quiet: [[]],
    invoke: (extra) => verifySignatureDetailed(pdf, extra),
  },
  {
    entry: 'validateCertificateChain',
    option: 'checkRevocation',
    value: true,
    quiet: [false],
    invoke: (extra) => validateCertificateChain([signer.certificate], extra),
  },
];

const message = (entry: string, option: string): string =>
  `\`${entry}()\`: the option \`${option}\` has no effect in this version.`;

function ignoredCalls(): unknown[][] {
  return emit.mock.calls.filter(([, options]) => (options as { code?: string }).code === CODE);
}

describe.each(ROWS)('$entry option $option', (row) => {
  it('warns once on the first call and not on the second', async () => {
    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(message(row.entry, row.option), { type: TYPE, code: CODE });

    await row.invoke({ [row.option]: row.value });
    expect(ignoredCalls()).toHaveLength(1);
  });

  it('does not warn when the option is absent or undefined', async () => {
    await row.invoke({});
    await row.invoke({ [row.option]: undefined });
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('does not warn for a value that changes nothing', async () => {
    for (const quiet of row.quiet ?? []) {
      await row.invoke({ [row.option]: quiet });
    }
    expect(ignoredCalls()).toHaveLength(0);
  });

  it('names no caller value in the message', async () => {
    await row.invoke({ [row.option]: row.value });
    const [text] = ignoredCalls()[0] as [string];
    if (typeof row.value === 'string' || typeof row.value === 'number') {
      expect(text).not.toContain(String(row.value));
    }
    expect(text).toBe(message(row.entry, row.option));
  });
});

describe('signPdf output does not change', () => {
  it('writes none of the ignored options', async () => {
    const signed = await signPdf(pdf, 'Signature1', {
      ...signer,
      reason: 'SECRET-REASON',
      location: 'SECRET-LOCATION',
      contactInfo: 'SECRET-CONTACT',
      timestampUrl: 'http://tsa.invalid/SECRET-URL',
    });
    const text = latin1.decode(signed);
    for (const value of ['SECRET-REASON', 'SECRET-LOCATION', 'SECRET-CONTACT', 'SECRET-URL']) {
      expect(text).not.toContain(value);
    }
    expect(text).not.toContain('/DocMDP');
    expect(text).not.toContain('/Lock');
    expect(ignoredCalls()).toHaveLength(4);
  });

  it('does not warn for reason and location that a visible appearance shows', async () => {
    const signed = await signPdf(pdf, 'Signature1', {
      ...signer,
      reason: 'Shown reason',
      location: 'Shown location',
      appearance: { rect: [50, 50, 250, 100] },
    });
    expect(latin1.decode(signed)).toContain('Shown reason');
    expect(ignoredCalls()).toHaveLength(0);
  });
});

describe('calls that are ignored as a whole', () => {
  const options = (): SignOptions => ({ ...signer });

  it('setCertificationLevel warns once and leaves no /DocMDP', async () => {
    const opts = options();
    setCertificationLevel(opts, MdpPermission.NoChanges);
    setCertificationLevel(opts, MdpPermission.FormFillAndSign);
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(
      '`setCertificationLevel()` has no effect in this version: `signPdf()` does not write a DocMDP certification.',
      { type: TYPE, code: CODE },
    );
    expect(latin1.decode((await signPdf(pdf, 'Signature1', opts)) as Uint8Array)).not.toContain(
      '/DocMDP',
    );
  });

  it('addFieldLock warns once and leaves no /Lock', async () => {
    const opts = options();
    addFieldLock(opts, { action: 'All' });
    addFieldLock(opts, { action: 'Include', fields: ['Name'] });
    expect(ignoredCalls()).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(
      '`addFieldLock()` has no effect in this version: `signPdf()` does not write a /Lock dictionary.',
      { type: TYPE, code: CODE },
    );
    expect(latin1.decode((await signPdf(pdf, 'Signature1', opts)) as Uint8Array)).not.toContain(
      '/Lock',
    );
  });

  it('addFieldLock still throws for an invalid lock and does not warn', () => {
    expect(() => addFieldLock(options(), { action: 'Include' })).toThrow(/requires at least one/);
    expect(ignoredCalls()).toHaveLength(0);
  });
});

describe('a null or primitive argument is accepted as it was before the warnings', () => {
  const NON_OBJECTS: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 7],
  ];

  it.each(NON_OBJECTS.slice(0, 2))(
    'signPdf signs with appearance %s',
    async (_label, appearance) => {
      const signed = await signPdf(pdf, 'Signature1', {
        ...signer,
        reason: 'r',
        appearance,
      } as unknown as SignOptions);
      expect(signed.length).toBeGreaterThan(pdf.length);
      expect(emit).toHaveBeenCalledWith(message('signPdf', 'reason'), { type: TYPE, code: CODE });
      expect(ignoredCalls()).toHaveLength(1);
    },
  );

  it.each(NON_OBJECTS)('verifySignatureDetailed resolves with trustedCerts %s', async (_l, v) => {
    await expect(verifySignatureDetailed(pdf, { trustedCerts: v } as never)).resolves.toEqual([]);
    expect(ignoredCalls()).toHaveLength(0);
  });

  it.each(NON_OBJECTS)('verifySignatureDetailed resolves with timeout %s', async (_l, v) => {
    await expect(verifySignatureDetailed(pdf, { timeout: v } as never)).resolves.toEqual([]);
  });

  it.each(NON_OBJECTS)('verifySignatureDetailed resolves with options %s', async (_l, v) => {
    await expect(verifySignatureDetailed(pdf, v as never)).resolves.toEqual([]);
    expect(ignoredCalls()).toHaveLength(0);
  });

  it.each(NON_OBJECTS)('validateCertificateChain accepts options %s', async (_l, v) => {
    await expect(validateCertificateChain([signer.certificate], v as never)).resolves.toBeDefined();
    expect(ignoredCalls()).toHaveLength(0);
  });
});
