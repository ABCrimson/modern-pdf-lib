/**
 * Tests for the structured validation report module (JSON + SARIF 2.1.0).
 *
 * Covers:
 * - toJsonReport: error/warning counting, conformance flag, findings passthrough
 * - toSarif: version/schema, single run, result count + mapping, level mapping,
 *   rule de-duplication, location (page) and property (clause/objectRef) mapping,
 *   custom tool name.
 */

import { describe, it, expect } from 'vitest';
import {
  toJsonReport,
  toSarif,
  SARIF_SCHEMA_URI,
  DEFAULT_SARIF_TOOL_NAME,
} from '../../../src/compliance/validationReport.js';
import type {
  ValidationFinding,
} from '../../../src/compliance/validationReport.js';

const findings: readonly ValidationFinding[] = [
  {
    ruleId: 'PDFA-6.1.2',
    message: 'File header missing %PDF version comment.',
    level: 'error',
    clause: '6.1.2',
    page: 1,
    objectRef: '3 0 R',
  },
  {
    ruleId: 'PDFA-6.1.3',
    message: 'Trailer ID array missing.',
    level: 'error',
    clause: '6.1.3',
  },
  {
    ruleId: 'PDFA-6.2.2',
    message: 'Embedded font program recommended.',
    level: 'warning',
    page: 2,
  },
  // Duplicate ruleId of the first finding (different page) — tests dedup.
  {
    ruleId: 'PDFA-6.1.2',
    message: 'File header malformed on second occurrence.',
    level: 'warning',
  },
];

describe('toJsonReport', () => {
  it('counts errors and warnings', () => {
    const report = toJsonReport(findings);
    expect(report.errorCount).toBe(2);
    expect(report.warningCount).toBe(2);
  });

  it('sets conformant=false when there is at least one error', () => {
    const report = toJsonReport(findings);
    expect(report.conformant).toBe(false);
  });

  it('sets conformant=true when there are no errors', () => {
    const warningsOnly: readonly ValidationFinding[] = [
      { ruleId: 'W1', message: 'a warning', level: 'warning' },
      { ruleId: 'W2', message: 'another warning', level: 'warning' },
    ];
    const report = toJsonReport(warningsOnly);
    expect(report.conformant).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(2);
  });

  it('treats an empty finding list as conformant', () => {
    const report = toJsonReport([]);
    expect(report).toEqual({
      conformant: true,
      errorCount: 0,
      warningCount: 0,
      findings: [],
    });
  });

  it('passes findings through unchanged (as a copy)', () => {
    const report = toJsonReport(findings);
    expect(report.findings).toEqual(findings);
    expect(report.findings).not.toBe(findings);
  });
});

describe('toSarif', () => {
  it('emits SARIF version 2.1.0 and the canonical schema URI', () => {
    const log = toSarif(findings);
    expect(log.version).toBe('2.1.0');
    expect(log.$schema).toBe(SARIF_SCHEMA_URI);
  });

  it('produces exactly one run', () => {
    const log = toSarif(findings);
    expect(log.runs).toHaveLength(1);
  });

  it('emits one result per finding', () => {
    const log = toSarif(findings);
    expect(log.runs[0].results).toHaveLength(findings.length);
  });

  it('maps the level of each finding directly', () => {
    const log = toSarif(findings);
    const levels = log.runs[0].results.map((r) => r.level);
    expect(levels).toEqual(['error', 'error', 'warning', 'warning']);
  });

  it('maps ruleId and message text for each result', () => {
    const log = toSarif(findings);
    const first = log.runs[0].results[0];
    expect(first.ruleId).toBe('PDFA-6.1.2');
    expect(first.message.text).toBe('File header missing %PDF version comment.');
  });

  it('de-duplicates rule descriptors by id (first-seen order)', () => {
    const log = toSarif(findings);
    const rules = log.runs[0].tool.driver.rules;
    expect(rules.map((r) => r.id)).toEqual([
      'PDFA-6.1.2',
      'PDFA-6.1.3',
      'PDFA-6.2.2',
    ]);
  });

  it('maps page onto a physical-location region', () => {
    const log = toSarif(findings);
    const first = log.runs[0].results[0];
    expect(first.locations).toBeDefined();
    const region = first.locations?.[0].physicalLocation.region;
    expect(region?.startLine).toBe(1);
  });

  it('omits locations when the finding has no page', () => {
    const log = toSarif(findings);
    // Second finding has clause but no page.
    expect(log.runs[0].results[1].locations).toBeUndefined();
  });

  it('surfaces clause and objectRef through the property bag', () => {
    const log = toSarif(findings);
    const first = log.runs[0].results[0];
    expect(first.properties?.clause).toBe('6.1.2');
    expect(first.properties?.objectRef).toBe('3 0 R');
  });

  it('omits properties when neither clause nor objectRef is present', () => {
    const log = toSarif(findings);
    // Third finding has only a page, no clause/objectRef.
    expect(log.runs[0].results[2].properties).toBeUndefined();
  });

  it('uses the default tool name when none is supplied', () => {
    const log = toSarif(findings);
    expect(log.runs[0].tool.driver.name).toBe(DEFAULT_SARIF_TOOL_NAME);
  });

  it('honors a custom tool name', () => {
    const log = toSarif(findings, 'my-validator');
    expect(log.runs[0].tool.driver.name).toBe('my-validator');
  });

  it('produces an empty run for an empty finding list', () => {
    const log = toSarif([]);
    expect(log.runs[0].results).toHaveLength(0);
    expect(log.runs[0].tool.driver.rules).toHaveLength(0);
  });
});
