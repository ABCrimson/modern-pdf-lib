/**
 * The signature entries refuse what they do not carry out with an `UnsupportedOptionError`, on
 * every call and before anything is written: `signPdf` `timestampUrl`, `setCertificationLevel()`
 * and `addFieldLock()` as whole calls, `verifySignatureDetailed` `timeout` and a non-empty
 * `trustedCerts`, and `validateCertificateChain` `checkRevocation: true` name the release that
 * carries them out (0.45.0); `compress: true` of `saveIncrementalWithSignaturePreservation` and of
 * the removed third parameter of `appendIncrementalUpdate` was removed in 0.41.0. Each row checks
 * the error and its message, the absent and undefined option, the values that ask for nothing,
 * and that the message names no caller value. `signPdf` `reason`, `location` and `contactInfo`
 * are carried out: they are written into the signature dictionary as text strings. No entry
 * warns any more.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPdf } from '../../../../src/index.js';
import { InvalidArgumentError, UnsupportedOptionError } from '../../../../src/errors.js';
import type { PdfLibVersion } from '../../../../src/errors.js';
import { signPdf } from '../../../../src/signature/pades/signatureHandler.js';
import { addFieldLock } from '../../../../src/signature/pades/fieldLock.js';
import type { FieldLockOptions } from '../../../../src/signature/pades/fieldLock.js';
import { MdpPermission, setCertificationLevel } from '../../../../src/signature/pades/mdpPolicy.js';
import { verifySignatureDetailed } from '../../../../src/signature/pades/detailedVerifier.js';
import { validateCertificateChain } from '../../../../src/signature/pki/chainValidator.js';
import type { SignOptions } from '../../../../src/signature/pades/signatureHandler.js';
import {
  appendIncrementalUpdate,
  saveIncrementalWithSignaturePreservation,
} from '../../../../src/signature/pades/incrementalSave.js';
import { resetWarningsForTesting } from '../../../../src/internal/warnings.js';
import { generateTestCert } from '../../../helpers/signature-trust-fixtures.js';

const latin1 = new TextDecoder('latin1');

let pdf: Uint8Array;
let signer: { certificate: Uint8Array; privateKey: Uint8Array };

beforeAll(async () => {
  const doc = createPdf();
  doc.addPage();
  pdf = await doc.save();
  signer = await generateTestCert('Option Signer');
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

/** The rejection of `call`, or a failed expectation when it settles without one. */
async function rejectionOf(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (error) {
    return error;
  }
  throw new Error('the call did not throw');
}

const sign = (extra: Record<string, unknown>): Promise<unknown> =>
  signPdf(pdf, 'Signature1', { ...signer, ...extra } as SignOptions);

const OBJECT = {
  objectNumber: 90,
  generationNumber: 0,
  data: new TextEncoder().encode('<< /Type /Probe >>'),
};

/** appendIncrementalUpdate as a JavaScript caller sees it: the third parameter left the type. */
const appendUntyped = appendIncrementalUpdate as (...args: unknown[]) => Uint8Array;

interface Row {
  /** The entry as the rule table names it, with `()`. */
  readonly entry: string;
  readonly option: string;
  /** The release that carries the option out; absent for a removed option. */
  readonly plannedFor?: PdfLibVersion;
  /** The value passed to trigger the error. */
  readonly value: unknown;
  /** Values that change nothing and must not throw. */
  readonly quiet?: readonly unknown[];
  readonly invoke: (extra: Record<string, unknown>) => Promise<unknown>;
}

const ROWS: readonly Row[] = [
  {
    entry: 'appendIncrementalUpdate()',
    option: 'compress',
    value: true,
    quiet: [false],
    invoke: async (extra) => appendUntyped(pdf, [OBJECT], extra),
  },
  {
    entry: 'saveIncrementalWithSignaturePreservation()',
    option: 'compress',
    value: true,
    quiet: [false],
    invoke: async (extra) => saveIncrementalWithSignaturePreservation(pdf, pdf, extra),
  },
  {
    entry: 'signPdf()',
    option: 'timestampUrl',
    plannedFor: '0.45.0',
    value: 'http://tsa.invalid/SECRET-URL',
    invoke: sign,
  },
  {
    entry: 'verifySignatureDetailed()',
    option: 'timeout',
    plannedFor: '0.45.0',
    value: 987_654,
    invoke: (extra) => verifySignatureDetailed(pdf, extra),
  },
  {
    entry: 'verifySignatureDetailed()',
    option: 'trustedCerts',
    plannedFor: '0.45.0',
    value: [new Uint8Array(1)],
    quiet: [[]],
    invoke: (extra) => verifySignatureDetailed(pdf, extra),
  },
  {
    entry: 'validateCertificateChain()',
    option: 'checkRevocation',
    plannedFor: '0.45.0',
    value: true,
    quiet: [false],
    invoke: (extra) => validateCertificateChain([signer.certificate], extra),
  },
];

/** The fixed message of a row (src/internal/options.ts). */
const message = ({ entry, option, plannedFor }: Row): string =>
  plannedFor === undefined
    ? `\`${entry}\`: the option \`${option}\` was removed in 0.41.0.`
    : `\`${entry}\`: the option \`${option}\` is not supported in this release; it is planned for ${plannedFor}.`;

describe.each(ROWS)('$entry option $option', (row) => {
  it('throws UnsupportedOptionError on every call', async () => {
    for (let call = 0; call < 2; call++) {
      const error = await rejectionOf(() => row.invoke({ [row.option]: row.value }));
      expect(error).toBeInstanceOf(UnsupportedOptionError);
      expect(error).toMatchObject({
        code: 'unsupported-option',
        entry: row.entry,
        option: row.option,
        plannedFor: row.plannedFor,
        message: message(row),
      });
    }
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not throw when the option is absent or undefined', async () => {
    await expect(row.invoke({})).resolves.toBeDefined();
    await expect(row.invoke({ [row.option]: undefined })).resolves.toBeDefined();
  });

  it('does not throw for a value that asks for nothing', async () => {
    for (const quiet of row.quiet ?? []) {
      await expect(row.invoke({ [row.option]: quiet })).resolves.toBeDefined();
    }
  });

  it('names no caller value in the message', async () => {
    const error = await rejectionOf(() => row.invoke({ [row.option]: row.value }));
    if (typeof row.value === 'string' || typeof row.value === 'number') {
      expect((error as Error).message).not.toContain(String(row.value));
    }
  });
});

describe('the removed compress option', () => {
  it('appendIncrementalUpdate writes the same bytes with compress false or a third undefined', () => {
    const bytes = appendIncrementalUpdate(pdf, [OBJECT]);
    expect(appendUntyped(pdf, [OBJECT], { compress: false })).toEqual(bytes);
    expect(appendUntyped(pdf, [OBJECT], undefined)).toEqual(bytes);
    expect(appendUntyped(pdf, [OBJECT], {})).toEqual(bytes);
  });

  it('saveIncrementalWithSignaturePreservation returns the same bytes with compress false', () => {
    expect(
      saveIncrementalWithSignaturePreservation(pdf, pdf, { compress: false } as never),
    ).toEqual(saveIncrementalWithSignaturePreservation(pdf, pdf));
  });
});

describe('calls refused as a whole', () => {
  const options = (): SignOptions => ({ ...signer });

  it('setCertificationLevel throws on every call and leaves the options unchanged', () => {
    const opts = options();
    for (const level of [MdpPermission.NoChanges, MdpPermission.FormFillAndSign]) {
      const call = (): void => setCertificationLevel(opts, level);
      expect(call).toThrow(UnsupportedOptionError);
      expect(call).toThrow(
        expect.objectContaining({
          code: 'unsupported-option',
          entry: 'setCertificationLevel()',
          option: undefined,
          plannedFor: '0.45.0',
          message:
            '`setCertificationLevel()` is not supported in this release; it is planned for 0.45.0.',
        }),
      );
    }
    expect(opts).toEqual(options());
    expect(emit).not.toHaveBeenCalled();
  });

  it('addFieldLock throws on every call and leaves the options unchanged', () => {
    const opts = options();
    const locks: readonly FieldLockOptions[] = [
      { action: 'All' },
      { action: 'Include', fields: ['Name'] },
    ];
    for (const lock of locks) {
      const call = (): void => addFieldLock(opts, lock);
      expect(call).toThrow(UnsupportedOptionError);
      expect(call).toThrow(
        expect.objectContaining({
          code: 'unsupported-option',
          entry: 'addFieldLock()',
          option: undefined,
          plannedFor: '0.45.0',
          message: '`addFieldLock()` is not supported in this release; it is planned for 0.45.0.',
        }),
      );
    }
    expect(opts).toEqual(options());
    expect(emit).not.toHaveBeenCalled();
  });

  it('addFieldLock throws InvalidArgumentError for an invalid lock first', () => {
    const call = (): void => addFieldLock(options(), { action: 'Include' });
    expect(call).toThrow(InvalidArgumentError);
    expect(call).toThrow(/requires at least one/);
  });
});

describe('signPdf reason, location and contactInfo are written', () => {
  // Text strings in hex form: "Approved" is ASCII, "München" PDFDocEncoding (ü is 0xFC), and
  // "日本" UTF-16BE after FE FF. tests/oracle/signature-text-entries.test.ts reads them with qpdf.
  const APPROVED = '<417070726f766564>';
  const MUENCHEN = '<4dfc6e6368656e>';
  const NIHON = '<feff65e5672c>';

  it('writes each passed option into the signature dictionary and warns nothing', async () => {
    const text = latin1.decode(
      (await sign({ reason: 'Approved', location: 'München', contactInfo: '日本' })) as Uint8Array,
    );
    expect(text).toContain(
      `/Reason ${APPROVED} /Location ${MUENCHEN} /ContactInfo ${NIHON} /ByteRange [`,
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('writes no entry for an absent or undefined option', async () => {
    for (const extra of [{}, { reason: undefined, location: undefined, contactInfo: undefined }]) {
      const text = latin1.decode((await sign(extra)) as Uint8Array);
      for (const key of ['/Reason', '/Location', '/ContactInfo']) {
        expect(text).not.toContain(key);
      }
    }
  });

  it('writes reason and location that a visible appearance also shows', async () => {
    const text = latin1.decode(
      (await sign({
        reason: 'Approved',
        location: 'München',
        appearance: { rect: [50, 50, 250, 100] },
      })) as Uint8Array,
    );
    // ASCII text, so its WinAnsiEncoding codes are its ASCII bytes, shown as a hex string.
    expect(text).toContain(`<${new TextEncoder().encode('Reason: Approved').toHex()}> Tj`);
    expect(text).toContain(`/Reason ${APPROVED} /Location ${MUENCHEN} /ByteRange [`);
    expect(emit).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    'signs with appearance %s and writes the reason',
    async (appearance) => {
      const text = latin1.decode((await sign({ reason: 'Approved', appearance })) as Uint8Array);
      expect(text).toContain(`/Reason ${APPROVED} /ByteRange [`);
      expect(emit).not.toHaveBeenCalled();
    },
  );
});

describe('a null or primitive argument is accepted as before', () => {
  const NON_OBJECTS: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 7],
  ];

  it.each(NON_OBJECTS)('verifySignatureDetailed resolves with trustedCerts %s', async (_l, v) => {
    await expect(verifySignatureDetailed(pdf, { trustedCerts: v } as never)).resolves.toEqual([]);
  });

  it.each(NON_OBJECTS.slice(1, 2))(
    'verifySignatureDetailed resolves with timeout %s',
    async (_l, v) => {
      await expect(verifySignatureDetailed(pdf, { timeout: v } as never)).resolves.toEqual([]);
    },
  );

  it.each([NON_OBJECTS[0]!, NON_OBJECTS[2]!])(
    'verifySignatureDetailed refuses timeout %s, a passed value',
    async (_l, v) => {
      await expect(verifySignatureDetailed(pdf, { timeout: v } as never)).rejects.toThrow(
        UnsupportedOptionError,
      );
    },
  );

  it.each(NON_OBJECTS)('verifySignatureDetailed resolves with options %s', async (_l, v) => {
    await expect(verifySignatureDetailed(pdf, v as never)).resolves.toEqual([]);
  });

  it.each(NON_OBJECTS)('validateCertificateChain accepts options %s', async (_l, v) => {
    await expect(validateCertificateChain([signer.certificate], v as never)).resolves.toBeDefined();
  });

  it.each(NON_OBJECTS)('appendIncrementalUpdate accepts a third argument %s', (_l, v) => {
    expect(appendUntyped(pdf, [OBJECT], v)).toEqual(appendIncrementalUpdate(pdf, [OBJECT]));
  });
});
