/**
 * @module compliance/eInvoiceValidate
 *
 * EN 16931 core business-rule validator for the typed {@link Invoice}
 * data model shared with the Factur-X / ZUGFeRD generator.
 *
 * EN 16931-1:2017 (the European semantic invoice standard) defines a set
 * of "BR-*" business rules. This module checks the subset that is
 * expressible from the fields actually present on the {@link Invoice}
 * model, plus the totals-calculation chain (BR-CO-*) when the caller
 * supplies the document-level totals it intends to write.
 *
 * The validator never throws: a structurally valid invoice yields an
 * empty issue list. Each detected violation is mapped to its exact
 * EN 16931 rule id, a human-readable message and a severity.
 *
 * Rules implemented (and their official EN 16931 text):
 * - BR-02   — An Invoice shall have an Invoice number (BT-1).
 * - BR-03   — An Invoice shall have an Invoice issue date (BT-2).
 * - BR-05   — An Invoice shall have an Invoice currency code (BT-5).
 * - BR-06   — An Invoice shall contain the Seller name (BT-27).
 * - BR-07   — An Invoice shall contain the Buyer name (BT-44).
 * - BR-16   — An Invoice shall have at least one Invoice line (BG-25).
 * - BR-CO-10 — Sum of Invoice line net amount (BT-106) = Σ line net (BT-131).
 * - BR-CO-13 — Invoice total without VAT (BT-109) = Σ line net (BT-131)
 *              − allowances (BT-107) + charges (BT-108). With the current
 *              model (no document-level allowances/charges) this reduces
 *              to BT-109 = Σ line net.
 * - BR-CO-15 — Invoice total with VAT (BT-112) = total without VAT (BT-109)
 *              + total VAT (BT-110).
 * - BR-CO-16 — Amount due (BT-115) = total with VAT (BT-112) − paid
 *              (BT-113) + rounding (BT-114). With no paid/rounding amount
 *              in the model this reduces to BT-115 = BT-112.
 *
 * Deliberately NOT implemented because the {@link Invoice} model carries
 * no corresponding field (documented limitation — see README of this
 * module / the project notes):
 * - BR-01 (Specification identifier, BT-24): the guideline URN is chosen
 *   by the generator's profile argument, not stored on the invoice.
 * - BR-04 (Invoice type code, BT-3): the generator hard-codes 380; the
 *   model has no type-code field to validate.
 *
 * References:
 * - EN 16931-1:2017, Annex (business rules)
 * - ConnectingEurope/eInvoicing-EN16931 schematron (rule text)
 * - OpenPEPPOL peppol-bis-invoice-3 (CEN-EN16931 rule expressions)
 */

import type { Invoice } from './facturX.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single EN 16931 business-rule violation. */
export interface EInvoiceIssue {
  /** The EN 16931 rule id, e.g. 'BR-02' or 'BR-CO-15'. */
  readonly rule: string;
  /** Human-readable description of the violation. */
  readonly message: string;
  /** Severity: a hard rule breach ('error') or an advisory ('warning'). */
  readonly severity: 'error' | 'warning';
}

/**
 * Document-level totals the caller intends to write onto the invoice.
 *
 * The base {@link Invoice} model computes its totals from the lines, so a
 * mismatch can only exist when a caller declares its own totals. Supplying
 * these enables the BR-CO-* calculation-chain checks; omitting them skips
 * those checks entirely (the computed totals are consistent by definition).
 *
 * All amounts are in the invoice currency.
 */
export interface DeclaredInvoiceTotals {
  /** Sum of Invoice line net amounts (BT-106). */
  readonly lineTotal: number;
  /**
   * Invoice total amount without VAT / tax basis total (BT-109).
   * Defaults to {@link DeclaredInvoiceTotals.lineTotal} when omitted,
   * since the model carries no document-level allowances or charges.
   */
  readonly taxBasisTotal?: number | undefined;
  /** Invoice total VAT amount (BT-110). */
  readonly taxTotal: number;
  /** Invoice total amount with VAT / grand total (BT-112). */
  readonly grandTotal: number;
  /** Amount due for payment (BT-115). Defaults to the grand total. */
  readonly duePayable?: number | undefined;
}

/**
 * An {@link Invoice} optionally annotated with the document-level totals
 * the caller plans to emit, enabling the BR-CO-* calculation checks.
 *
 * A plain {@link Invoice} is assignable to this type, so
 * {@link validateEn16931} accepts either.
 */
export interface ValidatableInvoice extends Invoice {
  /** Declared document totals to validate against the line-derived totals. */
  readonly declaredTotals?: DeclaredInvoiceTotals | undefined;
}

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

/**
 * Monetary comparison tolerance, in the invoice currency's major unit.
 * EN 16931 amounts are rounded to two decimals; half a cent of slack
 * absorbs accumulated floating-point and rounding noise.
 */
const MONETARY_TOLERANCE = 0.005;

/** True when `value` is a non-empty, non-whitespace string. */
function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

/** True when two monetary amounts are equal within {@link MONETARY_TOLERANCE}. */
function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONETARY_TOLERANCE;
}

/**
 * Round a monetary amount to two decimals using half-away-from-zero, the
 * commercial rounding convention EN 16931 applies to BT-* amounts (and the
 * convention the Factur-X generator emits). `Math.round` is half-up toward
 * +∞, which is wrong for negative amounts (e.g. a credit line), so the sign
 * is factored out explicitly.
 */
function roundToCents(value: number): number {
  return (Math.sign(value) * Math.round(Math.abs(value) * 100)) / 100;
}

/**
 * Sum the line net amounts (Σ BT-131) of an invoice.
 *
 * Per EN 16931 each line net amount (BT-131) is rounded to two decimals
 * before the document-level sum (BT-106 / BT-109) is formed. Summing the raw
 * `quantity × unitPrice` products instead would diverge from the spec total
 * for fractional unit prices and could falsely flag (or falsely pass) a
 * borderline BR-CO-10 / BR-CO-13 comparison.
 */
function sumLineNet(invoice: Invoice): number {
  let total = 0;
  for (const line of invoice.lines) {
    total += roundToCents(line.quantity * line.unitPrice);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate an invoice against the core EN 16931 business rules that are
 * checkable from the typed {@link Invoice} model.
 *
 * Content-presence rules (BR-02, BR-03, BR-05, BR-06, BR-07, BR-16) are
 * always evaluated. The totals-calculation chain (BR-CO-10, BR-CO-13,
 * BR-CO-15, BR-CO-16) is only evaluated when the caller supplies
 * {@link ValidatableInvoice.declaredTotals}; otherwise those checks are
 * skipped because the model derives consistent totals from its lines.
 *
 * The function never throws; a structurally valid invoice returns `[]`.
 *
 * @param invoice - The invoice (optionally annotated with declared totals).
 * @returns A list of {@link EInvoiceIssue}s, empty when fully valid.
 */
export function validateEn16931(invoice: ValidatableInvoice): EInvoiceIssue[] {
  const issues: EInvoiceIssue[] = [];

  // --- Content-presence rules ------------------------------------------

  // BR-02: An Invoice shall have an Invoice number (BT-1).
  if (!isNonEmptyText(invoice.invoiceNumber)) {
    issues.push({
      rule: 'BR-02',
      message: 'An Invoice shall have an Invoice number (BT-1).',
      severity: 'error',
    });
  }

  // BR-03: An Invoice shall have an Invoice issue date (BT-2).
  if (!isNonEmptyText(invoice.issueDate)) {
    issues.push({
      rule: 'BR-03',
      message: 'An Invoice shall have an Invoice issue date (BT-2).',
      severity: 'error',
    });
  }

  // BR-05: An Invoice shall have an Invoice currency code (BT-5).
  if (!isNonEmptyText(invoice.currency)) {
    issues.push({
      rule: 'BR-05',
      message: 'An Invoice shall have an Invoice currency code (BT-5).',
      severity: 'error',
    });
  }

  // BR-06: An Invoice shall contain the Seller name (BT-27).
  if (!isNonEmptyText(invoice.seller.name)) {
    issues.push({
      rule: 'BR-06',
      message: 'An Invoice shall contain the Seller name (BT-27).',
      severity: 'error',
    });
  }

  // BR-07: An Invoice shall contain the Buyer name (BT-44).
  if (!isNonEmptyText(invoice.buyer.name)) {
    issues.push({
      rule: 'BR-07',
      message: 'An Invoice shall contain the Buyer name (BT-44).',
      severity: 'error',
    });
  }

  // BR-16: An Invoice shall have at least one Invoice line (BG-25).
  if (invoice.lines.length === 0) {
    issues.push({
      rule: 'BR-16',
      message: 'An Invoice shall have at least one Invoice line (BG-25).',
      severity: 'error',
    });
  }

  // --- Totals calculation chain (BR-CO-*) ------------------------------

  const declared = invoice.declaredTotals;
  if (declared !== undefined) {
    const computedLineNet = sumLineNet(invoice);
    const taxBasisTotal = declared.taxBasisTotal ?? declared.lineTotal;
    const duePayable = declared.duePayable ?? declared.grandTotal;

    // BR-CO-10: Sum of Invoice line net amount (BT-106) = Σ line net (BT-131).
    if (!amountsEqual(declared.lineTotal, computedLineNet)) {
      issues.push({
        rule: 'BR-CO-10',
        message:
          'Sum of Invoice line net amount (BT-106) must equal the sum of ' +
          `Invoice line net amounts (BT-131): declared ` +
          `${declared.lineTotal.toFixed(2)} vs. computed ` +
          `${computedLineNet.toFixed(2)}.`,
        severity: 'error',
      });
    }

    // BR-CO-13: Invoice total without VAT (BT-109) = Σ line net (BT-131)
    //           − allowances (BT-107) + charges (BT-108). The model has no
    //           document-level allowances/charges, so BT-109 = Σ line net.
    if (!amountsEqual(taxBasisTotal, computedLineNet)) {
      issues.push({
        rule: 'BR-CO-13',
        message:
          'Invoice total amount without VAT (BT-109) must equal the sum of ' +
          'Invoice line net amounts (BT-131) minus document allowances ' +
          '(BT-107) plus document charges (BT-108): declared ' +
          `${taxBasisTotal.toFixed(2)} vs. expected ` +
          `${computedLineNet.toFixed(2)}.`,
        severity: 'error',
      });
    }

    // BR-CO-15: Invoice total with VAT (BT-112) = total without VAT (BT-109)
    //           + total VAT (BT-110).
    const expectedGrand = taxBasisTotal + declared.taxTotal;
    if (!amountsEqual(declared.grandTotal, expectedGrand)) {
      issues.push({
        rule: 'BR-CO-15',
        message:
          'Invoice total amount with VAT (BT-112) must equal Invoice total ' +
          'amount without VAT (BT-109) plus Invoice total VAT amount ' +
          `(BT-110): declared ${declared.grandTotal.toFixed(2)} vs. ` +
          `expected ${expectedGrand.toFixed(2)}.`,
        severity: 'error',
      });
    }

    // BR-CO-16: Amount due (BT-115) = total with VAT (BT-112) − paid (BT-113)
    //           + rounding (BT-114). No paid/rounding in the model, so
    //           BT-115 = BT-112.
    if (!amountsEqual(duePayable, declared.grandTotal)) {
      issues.push({
        rule: 'BR-CO-16',
        message:
          'Amount due for payment (BT-115) must equal Invoice total amount ' +
          'with VAT (BT-112) minus paid amount (BT-113) plus rounding amount ' +
          `(BT-114): declared ${duePayable.toFixed(2)} vs. expected ` +
          `${declared.grandTotal.toFixed(2)}.`,
        severity: 'error',
      });
    }
  }

  return issues;
}
