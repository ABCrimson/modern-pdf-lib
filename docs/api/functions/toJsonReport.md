[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / toJsonReport

# Function: toJsonReport()

```ts
function toJsonReport(findings): JsonReport;
```

Defined in: [src/compliance/validationReport.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L160)

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
