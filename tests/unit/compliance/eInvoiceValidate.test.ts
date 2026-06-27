/**
 * Tests for the EN 16931 core business-rule validator.
 *
 * Each violation is asserted by its BR-* rule-id prefix and the
 * {@link EInvoiceIssue} shape, so the tests stay resilient to changes
 * in the exact human-readable wording of each message.
 */

import { describe, expect, it } from 'vitest';

import type {
  Invoice,
  InvoiceLine,
  InvoiceParty,
} from '../../../src/compliance/facturX.js';
import {
  validateEn16931,
  type EInvoiceIssue,
  type ValidatableInvoice,
} from '../../../src/compliance/eInvoiceValidate.js';

const seller: InvoiceParty = {
  name: 'Muster GmbH',
  countryCode: 'DE',
  vatId: 'DE123456789',
};

const buyer: InvoiceParty = {
  name: 'Acme Buyer SARL',
  countryCode: 'FR',
  vatId: 'FR987654321',
};

const baseLines: readonly InvoiceLine[] = [
  { description: 'Widget A', quantity: 2, unitPrice: 10, taxPercent: 19 },
  { description: 'Service B', quantity: 1, unitPrice: 100, taxPercent: 19 },
];

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceNumber: 'INV-2026-0042',
    issueDate: '2026-06-25',
    currency: 'EUR',
    seller,
    buyer,
    lines: baseLines,
    ...overrides,
  };
}

/** Collect the set of distinct rule-id prefixes present in the issues. */
function ruleIds(issues: readonly EInvoiceIssue[]): readonly string[] {
  return issues.map((i) => i.rule);
}

/** True when at least one issue carries the given exact rule id. */
function hasRule(issues: readonly EInvoiceIssue[], rule: string): boolean {
  return issues.some((i) => i.rule === rule);
}

describe('validateEn16931', () => {
  it('returns [] for a fully valid invoice', () => {
    expect(validateEn16931(makeInvoice())).toEqual([]);
  });

  it('never throws and returns an array for an empty/edge invoice', () => {
    const result = validateEn16931(makeInvoice({ lines: [] }));
    expect(Array.isArray(result)).toBe(true);
  });

  it('flags a missing invoice number with BR-02', () => {
    const issues = validateEn16931(makeInvoice({ invoiceNumber: '' }));
    expect(hasRule(issues, 'BR-02')).toBe(true);
  });

  it('flags a whitespace-only invoice number with BR-02', () => {
    const issues = validateEn16931(makeInvoice({ invoiceNumber: '   ' }));
    expect(hasRule(issues, 'BR-02')).toBe(true);
  });

  it('flags a missing issue date with BR-03', () => {
    const issues = validateEn16931(makeInvoice({ issueDate: '' }));
    expect(hasRule(issues, 'BR-03')).toBe(true);
  });

  it('flags a missing currency code with BR-05', () => {
    const issues = validateEn16931(makeInvoice({ currency: '' }));
    expect(hasRule(issues, 'BR-05')).toBe(true);
  });

  it('flags a missing seller name with BR-06', () => {
    const issues = validateEn16931(
      makeInvoice({ seller: { name: '', countryCode: 'DE' } }),
    );
    expect(hasRule(issues, 'BR-06')).toBe(true);
  });

  it('flags a missing buyer name with BR-07', () => {
    const issues = validateEn16931(
      makeInvoice({ buyer: { name: '', countryCode: 'FR' } }),
    );
    expect(hasRule(issues, 'BR-07')).toBe(true);
  });

  it('flags zero invoice lines with BR-16', () => {
    const issues = validateEn16931(makeInvoice({ lines: [] }));
    expect(hasRule(issues, 'BR-16')).toBe(true);
  });

  it('reports every shape field on each issue', () => {
    const issues = validateEn16931(makeInvoice({ invoiceNumber: '' }));
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(typeof issue.rule).toBe('string');
      expect(issue.rule.length).toBeGreaterThan(0);
      expect(typeof issue.message).toBe('string');
      expect(issue.message.length).toBeGreaterThan(0);
      expect(['error', 'warning']).toContain(issue.severity);
    }
  });

  it('accumulates multiple violations at once', () => {
    const issues = validateEn16931(
      makeInvoice({ invoiceNumber: '', issueDate: '', currency: '' }),
    );
    expect(hasRule(issues, 'BR-02')).toBe(true);
    expect(hasRule(issues, 'BR-03')).toBe(true);
    expect(hasRule(issues, 'BR-05')).toBe(true);
  });

  it('marks the missing-id violation as an error severity', () => {
    const issues = validateEn16931(makeInvoice({ invoiceNumber: '' }));
    const br02 = issues.find((i) => i.rule === 'BR-02');
    expect(br02?.severity).toBe('error');
  });

  // ---------------------------------------------------------------------
  // BR-CO calculation consistency (declared totals vs. computed totals)
  // ---------------------------------------------------------------------

  it('returns [] when declared totals agree with the computed totals', () => {
    // Lines: 20 + 100 = 120 net; 19% tax = 22.80; grand = 142.80.
    const invoice: ValidatableInvoice = {
      ...makeInvoice(),
      declaredTotals: {
        lineTotal: 120,
        taxTotal: 22.8,
        grandTotal: 142.8,
        duePayable: 142.8,
      },
    };
    expect(validateEn16931(invoice)).toEqual([]);
  });

  it('flags a wrong declared grand total with a BR-CO calculation issue', () => {
    const invoice: ValidatableInvoice = {
      ...makeInvoice(),
      declaredTotals: {
        lineTotal: 120,
        taxTotal: 22.8,
        grandTotal: 999.99, // wrong: should be 142.80
        duePayable: 999.99,
      },
    };
    const issues = validateEn16931(invoice);
    expect(ruleIds(issues).some((r) => r.startsWith('BR-CO'))).toBe(true);
  });

  it('flags a wrong declared line total with BR-CO-10', () => {
    const invoice: ValidatableInvoice = {
      ...makeInvoice(),
      declaredTotals: {
        lineTotal: 500, // wrong: should be 120
        taxTotal: 22.8,
        grandTotal: 142.8,
        duePayable: 142.8,
      },
    };
    const issues = validateEn16931(invoice);
    expect(hasRule(issues, 'BR-CO-10')).toBe(true);
  });

  it('flags a wrong declared tax-basis/total without VAT with BR-CO-13', () => {
    const invoice: ValidatableInvoice = {
      ...makeInvoice(),
      declaredTotals: {
        lineTotal: 120,
        taxBasisTotal: 999, // wrong: should equal lineTotal (120)
        taxTotal: 22.8,
        grandTotal: 142.8,
        duePayable: 142.8,
      },
    };
    const issues = validateEn16931(invoice);
    expect(hasRule(issues, 'BR-CO-13')).toBe(true);
  });

  it('flags grand-total != net + VAT with BR-CO-15', () => {
    const invoice: ValidatableInvoice = {
      ...makeInvoice(),
      declaredTotals: {
        lineTotal: 120,
        taxTotal: 22.8,
        grandTotal: 200, // wrong: 120 + 22.80 != 200
        duePayable: 200,
      },
    };
    const issues = validateEn16931(invoice);
    expect(hasRule(issues, 'BR-CO-15')).toBe(true);
  });

  it('tolerates sub-cent rounding noise in declared totals', () => {
    const invoice: ValidatableInvoice = {
      ...makeInvoice(),
      declaredTotals: {
        lineTotal: 120.001,
        taxTotal: 22.799,
        grandTotal: 142.8,
        duePayable: 142.8,
      },
    };
    expect(validateEn16931(invoice)).toEqual([]);
  });

  it('does not emit BR-CO issues when no declared totals are supplied', () => {
    const issues = validateEn16931(makeInvoice());
    expect(ruleIds(issues).some((r) => r.startsWith('BR-CO'))).toBe(false);
  });

  // ---------------------------------------------------------------------
  // BR-CO per-line rounding of BT-131 (regression — BUG 6)
  // ---------------------------------------------------------------------

  it('compares against per-line-rounded BT-131 net (BR-CO-10/13)', () => {
    // 3 lines of qty 1 × 0.125 = 0.125 each. EN 16931 rounds each line net
    // (BT-131) to 2 decimals -> 0.13, so Σ BT-131 = 0.39, NOT the raw
    // 3 × 0.125 = 0.375. A caller that declares the spec-correct 0.39 must
    // pass; comparing against the unrounded 0.375 would falsely flag it
    // (|0.39 - 0.375| = 0.015 > 0.005 tolerance).
    const lines: readonly InvoiceLine[] = [
      { description: 'L1', quantity: 1, unitPrice: 0.125, taxPercent: 0 },
      { description: 'L2', quantity: 1, unitPrice: 0.125, taxPercent: 0 },
      { description: 'L3', quantity: 1, unitPrice: 0.125, taxPercent: 0 },
    ];
    const invoice: ValidatableInvoice = {
      ...makeInvoice({ lines }),
      declaredTotals: {
        lineTotal: 0.39,
        taxBasisTotal: 0.39,
        taxTotal: 0,
        grandTotal: 0.39,
        duePayable: 0.39,
      },
    };
    const issues = validateEn16931(invoice);
    expect(hasRule(issues, 'BR-CO-10')).toBe(false);
    expect(hasRule(issues, 'BR-CO-13')).toBe(false);
    expect(issues).toEqual([]);
  });

  it('still flags a line total that disagrees with the rounded BT-131 sum', () => {
    const lines: readonly InvoiceLine[] = [
      { description: 'L1', quantity: 1, unitPrice: 0.125, taxPercent: 0 },
      { description: 'L2', quantity: 1, unitPrice: 0.125, taxPercent: 0 },
      { description: 'L3', quantity: 1, unitPrice: 0.125, taxPercent: 0 },
    ];
    const invoice: ValidatableInvoice = {
      ...makeInvoice({ lines }),
      declaredTotals: {
        // The unrounded raw sum (0.375) is NOT the spec total (0.39); a
        // caller declaring 0.375 must still be flagged.
        lineTotal: 0.375,
        taxBasisTotal: 0.375,
        taxTotal: 0,
        grandTotal: 0.375,
        duePayable: 0.375,
      },
    };
    const issues = validateEn16931(invoice);
    expect(hasRule(issues, 'BR-CO-10')).toBe(true);
    expect(hasRule(issues, 'BR-CO-13')).toBe(true);
  });
});
