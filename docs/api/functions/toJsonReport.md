[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / toJsonReport

# Function: toJsonReport()

> **toJsonReport**(`findings`): [`JsonReport`](../interfaces/JsonReport.md)

Defined in: src/compliance/validationReport.ts:160

Build a compact [JsonReport](../interfaces/JsonReport.md) from a list of findings.

Counts errors and warnings; the document is considered conformant when there
are zero errors (warnings do not affect conformance).

## Parameters

### findings

readonly [`ValidationFinding`](../interfaces/ValidationFinding.md)[]

The validation findings to summarize.

## Returns

[`JsonReport`](../interfaces/JsonReport.md)

A structured JSON report.
