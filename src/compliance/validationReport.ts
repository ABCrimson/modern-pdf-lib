/**
 * @module compliance/validationReport
 *
 * Structured validation report generation for compliance findings.
 *
 * Transforms a flat list of {@link ValidationFinding} objects (produced by
 * PDF/A, PDF/X, PDF/UA, XMP or any other validator in this library) into two
 * standardized, machine-readable report formats:
 *
 * - **JSON report** ({@link toJsonReport}) — a compact summary with conformance
 *   status and error/warning counts, suitable for programmatic consumption or
 *   simple CI gates.
 * - **SARIF 2.1.0** ({@link toSarif}) — the OASIS Static Analysis Results
 *   Interchange Format, consumable by GitHub code scanning, Azure DevOps,
 *   VS Code SARIF viewers and many other tools.
 *
 * This module is a pure data transform: it has no dependency on PDF objects and
 * performs no I/O. Validators emit {@link ValidationFinding}s; this module
 * serializes them.
 *
 * Reference: SARIF 2.1.0 — OASIS Standard, March 2020.
 */

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

/** Severity level of a validation finding. */
export type ValidationLevel = 'error' | 'warning';

/**
 * A single validation finding produced by a compliance validator.
 *
 * `ruleId` identifies the rule that was violated (e.g. an ISO clause id or an
 * internal validator code). `clause`, `page` and `objectRef` are optional
 * location hints that are mapped into the corresponding report formats.
 */
export interface ValidationFinding {
  readonly ruleId: string;
  readonly message: string;
  readonly level: ValidationLevel;
  readonly clause?: string | undefined;
  readonly page?: number | undefined;
  readonly objectRef?: string | undefined;
}

// ---------------------------------------------------------------------------
// JSON report types
// ---------------------------------------------------------------------------

/** Compact JSON validation report with conformance status and counts. */
export interface JsonReport {
  readonly conformant: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly findings: readonly ValidationFinding[];
}

// ---------------------------------------------------------------------------
// SARIF 2.1.0 types (minimal but valid subset)
// ---------------------------------------------------------------------------

/** SARIF message object — carries human-readable text. */
export interface SarifMessage {
  readonly text: string;
}

/** SARIF rule descriptor referenced by results via its `id`. */
export interface SarifReportingDescriptor {
  readonly id: string;
}

/** SARIF tool driver — the analysis tool that produced the run. */
export interface SarifToolDriver {
  readonly name: string;
  readonly rules: readonly SarifReportingDescriptor[];
}

/** SARIF tool wrapper. */
export interface SarifTool {
  readonly driver: SarifToolDriver;
}

/** SARIF artifact location — a logical reference to the scanned artifact. */
export interface SarifArtifactLocation {
  readonly uri: string;
}

/** SARIF region — a 1-based location hint inside an artifact (page number). */
export interface SarifRegion {
  readonly startLine: number;
}

/** SARIF physical location — where a result was found. */
export interface SarifPhysicalLocation {
  readonly artifactLocation: SarifArtifactLocation;
  readonly region?: SarifRegion | undefined;
}

/** SARIF location wrapper. */
export interface SarifLocation {
  readonly physicalLocation: SarifPhysicalLocation;
}

/** Free-form property bag attached to a SARIF result. */
export interface SarifResultProperties {
  readonly clause?: string | undefined;
  readonly objectRef?: string | undefined;
}

/** A single SARIF result — one validation finding. */
export interface SarifResult {
  readonly ruleId: string;
  readonly level: ValidationLevel;
  readonly message: SarifMessage;
  readonly locations?: readonly SarifLocation[] | undefined;
  readonly properties?: SarifResultProperties | undefined;
}

/** A single SARIF run — one invocation of one tool. */
export interface SarifRun {
  readonly tool: SarifTool;
  readonly results: readonly SarifResult[];
}

/** A complete SARIF 2.1.0 log. */
export interface SarifLog {
  readonly version: '2.1.0';
  readonly $schema: string;
  readonly runs: readonly [SarifRun];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical SARIF 2.1.0 JSON schema URI. */
export const SARIF_SCHEMA_URI: string =
  'https://json.schemastore.org/sarif-2.1.0.json';

/** Default tool name reported in SARIF runs. */
export const DEFAULT_SARIF_TOOL_NAME: string = 'modern-pdf-lib';

/** Logical artifact URI used when a finding carries no concrete file path. */
const DEFAULT_ARTIFACT_URI = 'document.pdf';

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

/**
 * Build a compact {@link JsonReport} from a list of findings.
 *
 * Counts errors and warnings; the document is considered conformant when there
 * are zero errors (warnings do not affect conformance).
 *
 * @param findings - The validation findings to summarize.
 * @returns A structured JSON report.
 */
export function toJsonReport(
  findings: readonly ValidationFinding[],
): JsonReport {
  let errorCount = 0;
  let warningCount = 0;
  for (const finding of findings) {
    if (finding.level === 'error') {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
  }
  return {
    conformant: errorCount === 0,
    errorCount,
    warningCount,
    findings: [...findings],
  };
}

// ---------------------------------------------------------------------------
// SARIF report
// ---------------------------------------------------------------------------

/**
 * Build the optional `locations` array for a finding.
 *
 * A location is only emitted when the finding carries a page number, since that
 * is the only piece of information that maps naturally onto a SARIF region.
 */
function buildLocations(
  finding: ValidationFinding,
): readonly SarifLocation[] | undefined {
  if (finding.page === undefined) {
    return undefined;
  }
  const physicalLocation: SarifPhysicalLocation = {
    artifactLocation: { uri: DEFAULT_ARTIFACT_URI },
    region: { startLine: finding.page },
  };
  return [{ physicalLocation }];
}

/**
 * Build the optional property bag for a finding.
 *
 * `clause` and `objectRef` have no first-class SARIF representation, so they are
 * surfaced through the result-level property bag.
 */
function buildProperties(
  finding: ValidationFinding,
): SarifResultProperties | undefined {
  if (finding.clause === undefined && finding.objectRef === undefined) {
    return undefined;
  }
  return {
    clause: finding.clause,
    objectRef: finding.objectRef,
  };
}

/**
 * Build a SARIF 2.1.0 log from a list of findings.
 *
 * Produces exactly one run. Each finding maps to one SARIF result with its
 * level mapped directly (`error`/`warning`). The run's rule descriptor list is
 * de-duplicated by `ruleId`, preserving first-seen order. `page` is mapped onto
 * a physical-location region; `clause` and `objectRef` are surfaced via the
 * result property bag.
 *
 * @param findings - The validation findings to serialize.
 * @param toolName - Optional tool name; defaults to {@link DEFAULT_SARIF_TOOL_NAME}.
 * @returns A SARIF 2.1.0 log.
 */
export function toSarif(
  findings: readonly ValidationFinding[],
  toolName: string = DEFAULT_SARIF_TOOL_NAME,
): SarifLog {
  const results: SarifResult[] = [];
  const seenRuleIds = new Set<string>();
  const rules: SarifReportingDescriptor[] = [];

  for (const finding of findings) {
    if (!seenRuleIds.has(finding.ruleId)) {
      seenRuleIds.add(finding.ruleId);
      rules.push({ id: finding.ruleId });
    }
    results.push({
      ruleId: finding.ruleId,
      level: finding.level,
      message: { text: finding.message },
      locations: buildLocations(finding),
      properties: buildProperties(finding),
    });
  }

  return {
    version: '2.1.0',
    $schema: SARIF_SCHEMA_URI,
    runs: [
      {
        tool: { driver: { name: toolName, rules } },
        results,
      },
    ],
  };
}
