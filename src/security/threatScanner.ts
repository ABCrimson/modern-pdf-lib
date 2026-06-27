/**
 * @module security/threatScanner
 *
 * Static risk scanner for hostile PDF constructs.
 *
 * `scanPdfThreats` parses a PDF and walks its object graph looking for the
 * well-known dangerous constructs that malware and phishing PDFs rely on,
 * emitting one {@link ThreatFinding} per detected construct with a justified
 * severity. This is a *static* scanner — it does not execute anything; it only
 * reports what the document *would* do in a conforming viewer.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Detection method (precision is intentional)
 * ──────────────────────────────────────────────────────────────────────────
 * The primary scan walks the **parsed object graph** (every resolved indirect
 * object in the registry, plus the trailer's catalog). This lets the scanner
 * distinguish a dangerous *dictionary key* / *action subtype name* from the
 * same token appearing harmlessly inside a content stream or a literal string.
 * For example, the word "JavaScript" drawn as page text is NOT flagged,
 * because it is bytes inside a content-stream `PdfStream`, never a `/S
 * /JavaScript` action dictionary or a `/Names /JavaScript` name-tree key.
 *
 * Concretely, for every {@link PdfDict} (including stream dictionaries) we
 * inspect that dict's own keys and, where a key denotes an action, the
 * resolved `/S` (action subtype) *name*. We never substring-match raw bytes
 * for the primary scan. If the document cannot be parsed at all, a guarded
 * raw-byte fallback runs; it only matches tokens in their structural
 * dictionary form (e.g. `/S /JavaScript`, `/S/Launch`, `/OpenAction` as a
 * key) to avoid flagging content that merely contains those words. The
 * fallback is best-effort and documented as such.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Spec references (ISO 32000-1:2008, with ISO 32000-2:2020 where noted)
 * ──────────────────────────────────────────────────────────────────────────
 * - §12.6.2  Trigger events; §12.6.3 OpenAction (document catalog entry);
 *            additional-actions dictionaries reached via `/AA`.
 * - §12.6.4  Action types (the `/S` action-subtype name), in particular:
 *     · §12.6.4.2  Go-To actions (`/GoTo`)               — not flagged (local).
 *     · §12.6.4.3  Remote Go-To actions (`/GoToR`)       — remote document.
 *     · §12.6.4.5  Launch actions (`/Launch`)            — run a program/file.
 *     · §12.6.4.7  URI actions (`/URI`)                  — open a URL.
 *     · §12.6.4.8  Sound actions (`/Sound`)              — embedded sound.
 *     · §12.6.4.10 Movie actions (`/Movie`)              — embedded movie.
 *     · §12.6.4.16 JavaScript actions (`/JavaScript`)    — run script.
 *     · §12.7.5.2  Submit-form actions (`/SubmitForm`)   — POST form data.
 *     · §12.7.5.4  Import-data actions (`/ImportData`)   — import FDF data.
 * - §12.6.4.16 + §7.7.4: document-level JavaScript stored in the catalog
 *            `/Names` → `/JavaScript` name tree (a JavaScript name tree maps
 *            names to JavaScript action dictionaries that run on open).
 * - §7.11.3  File specification dictionaries (`/Filespec`); §7.11.4 Embedded
 *            file streams (`/EF`); §7.7.4 Name trees (the `/EmbeddedFiles`
 *            name tree). Used to read attachment file names for extension
 *            checks.
 * - §13.3    Sound; §13.4 Movies (annotations `/Subtype /Movie`,
 *            `/Subtype /Sound`).
 * - §13.6    Rich-media annotations (`/Subtype /RichMedia`) — ISO 32000-2
 *            §13.6 (formalised from the Adobe supplement to ISO 32000-1).
 * - §12.7.8  XFA forms (`/AcroForm` → `/XFA`) — XML Forms Architecture.
 *
 * Severities are justified at each detection site below. Every key cited here
 * is a real ISO 32000 dictionary key / action subtype; nothing is invented.
 *
 * @packageDocumentation
 */

import type { PdfObject } from '../core/pdfObjects.js';
import {
  PdfDict,
  PdfName,
  PdfStream,
  PdfString,
  PdfRef,
} from '../core/pdfObjects.js';
import type { PdfObjectRegistry } from '../core/pdfObjects.js';
import { loadPdf } from '../parser/documentParser.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Relative severity of a detected construct. */
export type ThreatSeverity = 'low' | 'medium' | 'high';

/** A single detected hostile/dangerous construct. */
export interface ThreatFinding {
  /** Stable category label (e.g. `"OpenAction"`, `"JavaScript"`). */
  category: string;
  /** Justified severity for this construct. */
  severity: ThreatSeverity;
  /** Human-readable description of what was found and why it matters. */
  detail: string;
  /** Indirect-object reference (`"12 0 R"`) when the finding is object-scoped. */
  objectRef?: string | undefined;
}

/** Aggregated scan result. */
export interface ThreatReport {
  /** All findings, in discovery order. */
  findings: ThreatFinding[];
  /** Maximum severity across {@link findings}, or `'none'` when empty. */
  riskLevel: ThreatSeverity | 'none';
}

// ---------------------------------------------------------------------------
// Internal: severity helpers
// ---------------------------------------------------------------------------

/** Numeric rank for severities so we can take a maximum. */
const SEVERITY_RANK: Record<ThreatSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Reverse lookup from rank back to severity. */
const RANK_SEVERITY: readonly ThreatSeverity[] = ['low', 'medium', 'high'];

/**
 * File-name extensions that denote directly executable / script payloads.
 * An attachment ending in one of these is treated as high severity because a
 * viewer's "open attachment" (or a `/Launch` action targeting it) can run it.
 */
const EXECUTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe', 'com', 'scr', 'pif', 'cpl', 'msi', 'msp', 'mst',
  'dll', 'sys', 'drv', 'ocx',
  'bat', 'cmd', 'ps1', 'psm1', 'vbs', 'vbe', 'vb', 'wsf', 'wsh', 'js', 'jse',
  'jar', 'class',
  'sh', 'bash', 'zsh', 'ksh', 'csh', 'command',
  'app', 'dmg', 'pkg',
  'lnk', 'url', 'reg', 'hta', 'gadget', 'inf', 'scf',
  'apk', 'deb', 'rpm', 'run', 'bin', 'elf', 'so', 'dylib',
  'py', 'pyc', 'pyw', 'rb', 'pl', 'php',
]);

// ---------------------------------------------------------------------------
// Internal: object-graph helpers
// ---------------------------------------------------------------------------

/** Read a `PdfName` value (without the leading `/`) from a dict entry. */
function nameValue(obj: PdfObject | undefined): string | undefined {
  if (obj !== undefined && obj.kind === 'name') {
    const v = (obj as PdfName).value;
    return v.startsWith('/') ? v.slice(1) : v;
  }
  return undefined;
}

/** Read a `PdfString` value from a dict entry. */
function stringValue(obj: PdfObject | undefined): string | undefined {
  if (obj !== undefined && obj.kind === 'string') {
    return (obj as PdfString).value;
  }
  return undefined;
}

/** Format a `PdfRef` as the canonical `"N G R"` string, if available. */
function refString(ref: PdfRef | undefined): string | undefined {
  return ref ? `${ref.objectNumber} ${ref.generationNumber} R` : undefined;
}

/** Lower-case file extension of a name, or `''` when there is none. */
function extensionOf(name: string): string {
  // Strip any path separators a malicious name might embed, then take the
  // text after the final dot.
  const base = name.replace(/[\\/]+/g, '/').split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  if (dot < 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan a PDF for hostile constructs and return a {@link ThreatReport}.
 *
 * The scan never executes any document content. It parses the PDF and walks
 * the parsed object graph (see the module header for the precise method and
 * ISO 32000 references). When parsing fails, a guarded raw-byte fallback runs.
 *
 * @param pdf  Raw PDF bytes.
 * @returns    A report of findings plus the aggregate `riskLevel`.
 */
export async function scanPdfThreats(pdf: Uint8Array): Promise<ThreatReport> {
  const findings: ThreatFinding[] = [];

  let scannedGraph = false;
  try {
    const doc = await loadPdf(pdf, { ignoreEncryption: true });
    const registry = doc.getRegistry();
    scanObjectGraph(registry, findings);
    scannedGraph = true;
  } catch {
    // Parsing failed entirely — fall through to the raw-byte fallback.
    scannedGraph = false;
  }

  if (!scannedGraph) {
    scanRawBytesFallback(pdf, findings);
  }

  return { findings, riskLevel: aggregateRisk(findings) };
}

// ---------------------------------------------------------------------------
// Primary scan: parsed object graph
// ---------------------------------------------------------------------------

/**
 * Walk every registered object and emit findings.
 *
 * We iterate the registry (every resolved indirect object). For each
 * dictionary (including stream dictionaries) we inspect that dict's *own
 * keys* and, where relevant, the resolved action-subtype `/S` *name*. Content
 * streams' raw bytes are never substring-scanned here, which is what makes the
 * scan precise (drawn text that merely says "JavaScript" is not a finding).
 */
function scanObjectGraph(
  registry: PdfObjectRegistry,
  findings: ThreatFinding[],
): void {
  // De-duplicate: a given action subtype reached from multiple parents should
  // still produce one finding per action object, keyed by its ref string.
  for (const entry of registry) {
    const obj = entry.object;
    const refStr = refString(entry.ref);

    // Examine dictionaries and stream dictionaries.
    let dict: PdfDict | undefined;
    if (obj.kind === 'dict') dict = obj as PdfDict;
    else if (obj.kind === 'stream') dict = (obj as PdfStream).dict;
    if (dict === undefined) continue;

    inspectDict(dict, refStr, findings);
  }
}

/**
 * Inspect a single dictionary's keys/values for dangerous constructs.
 *
 * @param dict     The dictionary (or stream dictionary).
 * @param refStr   The owning object's `"N G R"` string, if known.
 * @param findings Accumulator.
 */
function inspectDict(
  dict: PdfDict,
  refStr: string | undefined,
  findings: ThreatFinding[],
): void {
  // --- Auto-run: /OpenAction (catalog) — §12.6.3 -------------------------
  // The catalog's /OpenAction runs automatically when the document opens.
  // Auto-execution without user consent → medium.
  if (dict.has('/OpenAction')) {
    findings.push({
      category: 'OpenAction',
      severity: 'medium',
      detail:
        'Document defines an /OpenAction that runs automatically when the ' +
        'PDF is opened (ISO 32000 §12.6.3).',
      objectRef: refStr,
    });
  }

  // --- Auto-run: /AA additional actions — §12.6.2/§12.6.3 ----------------
  // /AA on the catalog (document additional actions: WC/WS/DS/WP/DP) or on a
  // page/field fires on viewer events (close/save/print/...). Auto-trigger
  // without consent → medium.
  if (dict.has('/AA')) {
    findings.push({
      category: 'AA',
      severity: 'medium',
      detail:
        'Document or object defines /AA additional actions that fire on ' +
        'viewer events such as open/close/print/save (ISO 32000 §12.6.2).',
      objectRef: refStr,
    });
  }

  // --- Document-level JavaScript name tree — §7.7.4 / §12.6.4.16 ----------
  // Catalog /Names → /JavaScript maps names to JavaScript actions that run on
  // open. Arbitrary auto-run script → high. We detect the name-tree key here;
  // the individual JS action dicts are also caught below via /S /JavaScript.
  if (dict.has('/JavaScript')) {
    findings.push({
      category: 'JavaScript',
      severity: 'high',
      detail:
        'A /JavaScript name tree (catalog /Names → /JavaScript) is present; ' +
        'these scripts execute automatically on open (ISO 32000 §12.6.4.16, ' +
        '§7.7.4).',
      objectRef: refStr,
    });
  }

  // --- Action subtype (/S) — §12.6.4 -------------------------------------
  // An action dictionary names its type via /S. Flag the dangerous subtypes.
  const subtype = nameValue(dict.get('/S'));
  if (subtype !== undefined) {
    inspectActionSubtype(subtype, dict, refStr, findings);
  }

  // --- XFA forms — §12.7.8 -----------------------------------------------
  // An /AcroForm with an /XFA entry is an XFA (XML Forms Architecture) form.
  // XFA expands the attack surface (its own scripting/data model). Low.
  if (dict.has('/XFA')) {
    findings.push({
      category: 'XFA',
      severity: 'low',
      detail:
        'Document contains an XFA form (/AcroForm → /XFA, ISO 32000 §12.7.8); ' +
        'XFA carries its own scripting and data-binding model.',
      objectRef: refStr,
    });
  }

  // --- Annotation subtypes carrying embedded media — §13.x ---------------
  // /Subtype on an annotation dictionary. RichMedia/Movie/Sound embed media
  // that some viewers render/play. Low (media, not direct code execution).
  const annotSubtype = nameValue(dict.get('/Subtype'));
  if (annotSubtype === 'RichMedia') {
    findings.push({
      category: 'RichMedia',
      severity: 'low',
      detail:
        'Rich-media annotation (/Subtype /RichMedia, ISO 32000-2 §13.6) ' +
        'embeds interactive multimedia (e.g. Flash/video).',
      objectRef: refStr,
    });
  } else if (annotSubtype === 'Movie') {
    findings.push({
      category: 'Movie',
      severity: 'low',
      detail:
        'Movie annotation (/Subtype /Movie, ISO 32000 §13.4) embeds video/' +
        'animation content.',
      objectRef: refStr,
    });
  } else if (annotSubtype === 'Sound') {
    findings.push({
      category: 'Sound',
      severity: 'low',
      detail:
        'Sound annotation (/Subtype /Sound, ISO 32000 §13.3) embeds audio ' +
        'content.',
      objectRef: refStr,
    });
  }

  // --- /RichMedia / /Movie / /Sound as a dictionary key ------------------
  // These also appear as keys (e.g. a /Movie entry on an annotation, or a
  // /RichMedia entry). Catch the key form too, without double-counting the
  // /Subtype detections above.
  if (dict.has('/RichMedia') && annotSubtype !== 'RichMedia') {
    findings.push({
      category: 'RichMedia',
      severity: 'low',
      detail:
        'Object references rich-media content via a /RichMedia entry ' +
        '(ISO 32000-2 §13.6).',
      objectRef: refStr,
    });
  }
  if (dict.has('/Movie') && annotSubtype !== 'Movie') {
    findings.push({
      category: 'Movie',
      severity: 'low',
      detail: 'Object references movie content via a /Movie entry (ISO 32000 §13.4).',
      objectRef: refStr,
    });
  }
  if (dict.has('/Sound') && annotSubtype !== 'Sound' && subtype !== 'Sound') {
    findings.push({
      category: 'Sound',
      severity: 'low',
      detail: 'Object references sound content via a /Sound entry (ISO 32000 §13.3).',
      objectRef: refStr,
    });
  }

  // --- Embedded executable files — §7.11.3 / §7.11.4 ---------------------
  // A file specification dictionary (/Type /Filespec) names the attachment in
  // /F and /UF. An executable/script extension means "open attachment" can run
  // it. High. We only inspect filespec dicts (key /EF or /Type /Filespec).
  const isFilespec =
    nameValue(dict.get('/Type')) === 'Filespec' || dict.has('/EF');
  if (isFilespec) {
    const fileName = stringValue(dict.get('/UF')) ?? stringValue(dict.get('/F'));
    if (fileName !== undefined) {
      const ext = extensionOf(fileName);
      if (ext !== '' && EXECUTABLE_EXTENSIONS.has(ext)) {
        findings.push({
          category: 'EmbeddedFile',
          severity: 'high',
          detail:
            `Embedded file "${fileName}" has an executable/script extension ` +
            `".${ext}" (ISO 32000 §7.11.3/§7.11.4); opening it can run code.`,
          objectRef: refStr,
        });
      }
    }
  }
}

/**
 * Flag a dangerous action `/S` subtype. Subtypes are ISO 32000 §12.6.4 /
 * §12.7.5 action types.
 */
function inspectActionSubtype(
  subtype: string,
  dict: PdfDict,
  refStr: string | undefined,
  findings: ThreatFinding[],
): void {
  switch (subtype) {
    case 'JavaScript':
      // §12.6.4.16 — runs arbitrary script. High.
      findings.push({
        category: 'JavaScript',
        severity: 'high',
        detail:
          'JavaScript action (/S /JavaScript, ISO 32000 §12.6.4.16) executes ' +
          'script in the viewer.',
        objectRef: refStr,
      });
      break;
    case 'Launch':
      // §12.6.4.5 — launches an application or opens a file. High.
      findings.push({
        category: 'Launch',
        severity: 'high',
        detail:
          'Launch action (/S /Launch, ISO 32000 §12.6.4.5) can run an ' +
          'external application or open a file.',
        objectRef: refStr,
      });
      break;
    case 'URI':
      // §12.6.4.7 — opens a URL. Data exfiltration / phishing vector. Medium.
      findings.push({
        category: 'URI',
        severity: 'medium',
        detail:
          'URI action (/S /URI, ISO 32000 §12.6.4.7) opens a remote URL ' +
          `${describeUri(dict)}.`,
        objectRef: refStr,
      });
      break;
    case 'SubmitForm':
      // §12.7.5.2 — POSTs form data to a (possibly remote) URL. Medium.
      findings.push({
        category: 'SubmitForm',
        severity: 'medium',
        detail:
          'SubmitForm action (/S /SubmitForm, ISO 32000 §12.7.5.2) sends form ' +
          'data to a URL (potential data exfiltration).',
        objectRef: refStr,
      });
      break;
    case 'ImportData':
      // §12.7.5.4 — imports FDF data from a file. Low.
      findings.push({
        category: 'ImportData',
        severity: 'low',
        detail:
          'ImportData action (/S /ImportData, ISO 32000 §12.7.5.4) imports ' +
          'external form data.',
        objectRef: refStr,
      });
      break;
    case 'GoToR':
      // §12.6.4.3 — remote go-to into another (possibly remote) document. Low.
      findings.push({
        category: 'GoToR',
        severity: 'low',
        detail:
          'Remote Go-To action (/S /GoToR, ISO 32000 §12.6.4.3) targets an ' +
          'external document.',
        objectRef: refStr,
      });
      break;
    case 'Movie':
      // §12.6.4.10 — plays a movie. Low (media).
      findings.push({
        category: 'Movie',
        severity: 'low',
        detail: 'Movie action (/S /Movie, ISO 32000 §12.6.4.10) plays embedded video.',
        objectRef: refStr,
      });
      break;
    case 'Sound':
      // §12.6.4.8 — plays a sound. Low (media).
      findings.push({
        category: 'Sound',
        severity: 'low',
        detail: 'Sound action (/S /Sound, ISO 32000 §12.6.4.8) plays embedded audio.',
        objectRef: refStr,
      });
      break;
    default:
      // Other action types (GoTo, Named, Hide, ...) are not inherently
      // dangerous and are intentionally not flagged.
      break;
  }
}

/** Append the target URL of a /URI action to the detail string, if present. */
function describeUri(dict: PdfDict): string {
  const uri = stringValue(dict.get('/URI'));
  return uri !== undefined ? `→ "${uri}"` : '';
}

// ---------------------------------------------------------------------------
// Fallback scan: raw bytes (only when parsing fails)
// ---------------------------------------------------------------------------

/**
 * Best-effort raw-byte fallback used only when the PDF cannot be parsed.
 *
 * To stay precise we match constructs only in their *structural* dictionary
 * form — action subtypes as `/S /Type` (optionally without the inner space)
 * and `/OpenAction`/`/AA`/`/JavaScript` as dictionary keys (a `/` immediately
 * followed by the token and then a PDF delimiter). This avoids flagging the
 * same words when they appear as content-stream text or inside a literal
 * string. It is heuristic and clearly less reliable than the graph walk.
 */
function scanRawBytesFallback(pdf: Uint8Array, findings: ThreatFinding[]): void {
  const text = new TextDecoder('latin1').decode(pdf);

  // Key-form detections: "/Key" followed by whitespace, '/', '(', '<', '[' or EOF.
  const keyForm = (key: string): RegExp =>
    new RegExp(`/${key}(?=[\\s/(<\\[\\]>]|$)`);

  if (keyForm('OpenAction').test(text)) {
    findings.push({
      category: 'OpenAction',
      severity: 'medium',
      detail: 'Raw scan: /OpenAction key present (ISO 32000 §12.6.3).',
    });
  }
  if (keyForm('AA').test(text)) {
    findings.push({
      category: 'AA',
      severity: 'medium',
      detail: 'Raw scan: /AA additional-actions key present (ISO 32000 §12.6.2).',
    });
  }
  if (keyForm('JavaScript').test(text) || /\/S\s*\/JavaScript\b/.test(text)) {
    findings.push({
      category: 'JavaScript',
      severity: 'high',
      detail: 'Raw scan: JavaScript action/name tree present (ISO 32000 §12.6.4.16).',
    });
  }
  if (/\/S\s*\/Launch\b/.test(text)) {
    findings.push({
      category: 'Launch',
      severity: 'high',
      detail: 'Raw scan: /S /Launch action present (ISO 32000 §12.6.4.5).',
    });
  }
  if (/\/S\s*\/URI\b/.test(text)) {
    findings.push({
      category: 'URI',
      severity: 'medium',
      detail: 'Raw scan: /S /URI action present (ISO 32000 §12.6.4.7).',
    });
  }
  if (/\/S\s*\/SubmitForm\b/.test(text)) {
    findings.push({
      category: 'SubmitForm',
      severity: 'medium',
      detail: 'Raw scan: /S /SubmitForm action present (ISO 32000 §12.7.5.2).',
    });
  }
  if (/\/S\s*\/ImportData\b/.test(text)) {
    findings.push({
      category: 'ImportData',
      severity: 'low',
      detail: 'Raw scan: /S /ImportData action present (ISO 32000 §12.7.5.4).',
    });
  }
  if (/\/S\s*\/GoToR\b/.test(text)) {
    findings.push({
      category: 'GoToR',
      severity: 'low',
      detail: 'Raw scan: /S /GoToR remote go-to present (ISO 32000 §12.6.4.3).',
    });
  }
  if (/\/Subtype\s*\/RichMedia\b/.test(text) || keyForm('RichMedia').test(text)) {
    findings.push({
      category: 'RichMedia',
      severity: 'low',
      detail: 'Raw scan: RichMedia annotation present (ISO 32000-2 §13.6).',
    });
  }
  if (/\/Subtype\s*\/Movie\b/.test(text) || /\/S\s*\/Movie\b/.test(text)) {
    findings.push({
      category: 'Movie',
      severity: 'low',
      detail: 'Raw scan: Movie content/action present (ISO 32000 §13.4).',
    });
  }
  if (/\/Subtype\s*\/Sound\b/.test(text) || /\/S\s*\/Sound\b/.test(text)) {
    findings.push({
      category: 'Sound',
      severity: 'low',
      detail: 'Raw scan: Sound content/action present (ISO 32000 §13.3).',
    });
  }
  if (keyForm('XFA').test(text)) {
    findings.push({
      category: 'XFA',
      severity: 'low',
      detail: 'Raw scan: /XFA form present (ISO 32000 §12.7.8).',
    });
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Maximum severity across findings, or `'none'` when there are none. */
function aggregateRisk(findings: readonly ThreatFinding[]): ThreatSeverity | 'none' {
  let maxRank = 0;
  for (const f of findings) {
    const rank = SEVERITY_RANK[f.severity];
    if (rank > maxRank) maxRank = rank;
  }
  if (maxRank === 0) return 'none';
  return RANK_SEVERITY[maxRank - 1]!;
}
