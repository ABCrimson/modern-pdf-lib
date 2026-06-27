/**
 * Tests for the static PDF threat scanner (src/security/threatScanner.ts).
 *
 * The scanner loads a PDF, walks the parsed object graph, and reports
 * well-known hostile constructs (auto-run actions, document JavaScript,
 * Launch/remote/exfiltration actions, embedded media, executable
 * attachments, XFA forms) with a justified severity per ISO 32000.
 *
 * Test inputs are built with the real public API (createPdf, addJavaScript,
 * addDocumentOpenAction, attachFile, ...) and round-tripped through
 * save()/loadPdf so the scanner sees a genuine parsed object graph.
 */

import { describe, it, expect } from 'vitest';
import { createPdf } from '../../../src/core/pdfDocument.js';
import { PageSizes } from '../../../src/core/pdfPage.js';
import {
  addDocumentOpenAction,
  addDocumentCloseAction,
} from '../../../src/form/documentScripts.js';
import { scanPdfThreats } from '../../../src/security/threatScanner.js';
import type { ThreatReport, ThreatFinding } from '../../../src/security/threatScanner.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save a document to bytes (the scanner consumes raw PDF bytes). */
async function bytesOf(buildFn: (doc: ReturnType<typeof createPdf>) => void | Promise<void>): Promise<Uint8Array> {
  const doc = createPdf();
  doc.addPage(PageSizes.A4);
  await buildFn(doc);
  return doc.save();
}

/** Collect all findings whose category contains the given substring. */
function byCategory(report: ThreatReport, needle: string): ThreatFinding[] {
  return report.findings.filter((f) => f.category.includes(needle));
}

/**
 * Assemble a raw PDF from a list of indirect-object body strings (each the full
 * `"N 0 obj … endobj"` definition, in object-number order starting at 1) with a
 * correct cross-reference table and trailer. This lets a test express an exact
 * object graph — including indirect references between objects — that the parser
 * loads as a genuine registry. The object bodies are written verbatim, so a test
 * can place `/S 99 0 R` (an indirect reference) where a name would normally sit.
 */
function buildRawPdf(objects: readonly string[], rootObjNum: number): Uint8Array {
  const enc = new TextEncoder();
  let body = '%PDF-1.7\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(enc.encode(body).length);
    body += obj.endsWith('\n') ? obj : obj + '\n';
  }
  const xrefPos = enc.encode(body).length;
  const count = objects.length + 1; // +1 for the free object 0
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  const trailer =
    `trailer\n<</Size ${count}/Root ${rootObjNum} 0 R>>\n` +
    `startxref\n${xrefPos}\n%%EOF\n`;
  return enc.encode(body + xref + trailer);
}

// ---------------------------------------------------------------------------
// Clean document
// ---------------------------------------------------------------------------

describe('scanPdfThreats — clean document', () => {
  it('reports no findings and riskLevel "none" for a plain createPdf() doc', async () => {
    const bytes = await bytesOf((doc) => {
      const page = doc.getPage(0);
      page.drawText('Just some harmless text.', { x: 50, y: 700, size: 12 });
    });

    const report = await scanPdfThreats(bytes);
    expect(report.findings).toEqual([]);
    expect(report.riskLevel).toBe('none');
  });

  it('does not flag the literal token "JavaScript" appearing inside page text content', async () => {
    // The word "JavaScript" / "OpenAction" inside drawn text must NOT be a
    // finding — those are stream content, not dictionary keys/actions.
    const bytes = await bytesOf((doc) => {
      const page = doc.getPage(0);
      page.drawText('This document mentions JavaScript and OpenAction and Launch.', {
        x: 50,
        y: 700,
        size: 10,
      });
    });

    const report = await scanPdfThreats(bytes);
    expect(report.findings).toEqual([]);
    expect(report.riskLevel).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// OpenAction
// ---------------------------------------------------------------------------

describe('scanPdfThreats — auto-run actions', () => {
  it('flags a catalog /OpenAction', async () => {
    const bytes = await bytesOf((doc) => {
      addDocumentOpenAction(doc, 'app.alert("opened");');
    });

    const report = await scanPdfThreats(bytes);
    const openActionFindings = byCategory(report, 'OpenAction');
    expect(openActionFindings.length).toBeGreaterThanOrEqual(1);
  });

  it('flags catalog /AA additional actions', async () => {
    const bytes = await bytesOf((doc) => {
      addDocumentCloseAction(doc, 'app.alert("closing");');
    });

    const report = await scanPdfThreats(bytes);
    const aaFindings = byCategory(report, 'AA');
    expect(aaFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Document-level JavaScript
// ---------------------------------------------------------------------------

describe('scanPdfThreats — document JavaScript', () => {
  it('flags document-level JavaScript as a high-severity finding', async () => {
    const bytes = await bytesOf((doc) => {
      doc.addJavaScript('evil', 'app.launchURL("http://attacker.example");');
    });

    const report = await scanPdfThreats(bytes);
    const jsFindings = byCategory(report, 'JavaScript');
    expect(jsFindings.length).toBeGreaterThanOrEqual(1);
    expect(jsFindings.some((f) => f.severity === 'high')).toBe(true);
  });

  it('escalates riskLevel to high when JavaScript is present', async () => {
    const bytes = await bytesOf((doc) => {
      // OpenAction (medium) + named JS (high) → max should be high.
      addDocumentOpenAction(doc, 'doStuff();');
    });

    const report = await scanPdfThreats(bytes);
    // addDocumentOpenAction registers a named JS entry too → high present.
    expect(report.riskLevel).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Executable embedded files
// ---------------------------------------------------------------------------

describe('scanPdfThreats — embedded executable files', () => {
  it('flags an embedded file with an executable extension (.exe) as high', async () => {
    const bytes = await bytesOf((doc) => {
      doc.attachFile('payload.exe', new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), 'application/octet-stream');
    });

    const report = await scanPdfThreats(bytes);
    const fileFindings = byCategory(report, 'EmbeddedFile');
    expect(fileFindings.length).toBeGreaterThanOrEqual(1);
    expect(fileFindings.some((f) => f.severity === 'high')).toBe(true);
  });

  it('does NOT flag an embedded file with a benign extension (.txt)', async () => {
    const bytes = await bytesOf((doc) => {
      doc.attachFile('notes.txt', new TextEncoder().encode('hello'), 'text/plain');
    });

    const report = await scanPdfThreats(bytes);
    const fileFindings = byCategory(report, 'EmbeddedFile');
    expect(fileFindings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// riskLevel aggregation
// ---------------------------------------------------------------------------

describe('scanPdfThreats — riskLevel aggregation', () => {
  it('riskLevel reflects the maximum severity across findings', async () => {
    const bytes = await bytesOf((doc) => {
      // medium (OpenAction) + high (JS) + high (.exe attachment)
      addDocumentOpenAction(doc, 'init();');
      doc.attachFile('run.bat', new Uint8Array([1, 2, 3]), 'application/octet-stream');
    });

    const report = await scanPdfThreats(bytes);
    expect(report.riskLevel).toBe('high');
    expect(report.findings.length).toBeGreaterThanOrEqual(2);
  });

  it('returns a well-formed report object shape', async () => {
    const bytes = await bytesOf(() => {
      /* clean */
    });
    const report = await scanPdfThreats(bytes);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(['none', 'low', 'medium', 'high']).toContain(report.riskLevel);
  });
});

// ---------------------------------------------------------------------------
// Indirect-reference evasion (regression)
// ---------------------------------------------------------------------------
//
// A PDF object value may be written either DIRECTLY (`/S /JavaScript`) or as an
// INDIRECT REFERENCE to another object (`/S 99 0 R` where object 99 is the name
// `/JavaScript`). Both are equivalent to a conforming viewer. The scanner read
// `/S`, `/Type`, `/Subtype`, `/UF`, `/F`, and `/URI` with helpers that only
// accepted a directly-embedded name/string and ignored a PdfRef — so an
// attacker who hid the dangerous name one indirection away evaded detection and
// the malicious PDF reported clean. The scanner must resolve the reference
// before classifying the value, exactly as the sanitizer does.
describe('scanPdfThreats — indirect-reference evasion', () => {
  it('flags a JavaScript action whose /S is an INDIRECT REF to /JavaScript', async () => {
    // Object 4 is the bare name /JavaScript; the action dict (obj 3) points its
    // /S at it via "4 0 R" instead of embedding the name directly.
    const pdf = buildRawPdf(
      [
        '1 0 obj\n<</Type/Catalog/Pages 2 0 R/OpenAction 3 0 R>>\nendobj',
        '2 0 obj\n<</Type/Pages/Kids[]/Count 0>>\nendobj',
        '3 0 obj\n<</Type/Action/S 4 0 R/JS(app.alert\\(1\\))>>\nendobj',
        '4 0 obj\n/JavaScript\nendobj',
      ],
      1,
    );

    const report = await scanPdfThreats(pdf);
    const jsFindings = byCategory(report, 'JavaScript');
    expect(jsFindings.some((f) => f.severity === 'high')).toBe(true);
    expect(report.riskLevel).toBe('high');
  });

  it('flags an embedded executable whose /UF is an INDIRECT REF to a string', async () => {
    // Filespec (obj 3) hides the executable filename one indirection away: its
    // /UF is "4 0 R", and object 4 is the literal string "(payload.exe)".
    const pdf = buildRawPdf(
      [
        '1 0 obj\n<</Type/Catalog/Pages 2 0 R/Names 5 0 R>>\nendobj',
        '2 0 obj\n<</Type/Pages/Kids[]/Count 0>>\nendobj',
        '3 0 obj\n<</Type/Filespec/UF 4 0 R/EF<</F 6 0 R>>>>\nendobj',
        '4 0 obj\n(payload.exe)\nendobj',
        '5 0 obj\n<</EmbeddedFiles<</Names[(payload.exe) 3 0 R]>>>>\nendobj',
        '6 0 obj\n<</Type/EmbeddedFile/Length 4>>\nstream\nMZ\x90\x00\nendstream\nendobj',
      ],
      1,
    );

    const report = await scanPdfThreats(pdf);
    const fileFindings = byCategory(report, 'EmbeddedFile');
    expect(fileFindings.some((f) => f.severity === 'high')).toBe(true);
    expect(report.riskLevel).toBe('high');
  });
});
