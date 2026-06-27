[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / toSarif

# Function: toSarif()

```ts
function toSarif(findings, toolName?): SarifLog;
```

Defined in: [src/compliance/validationReport.ts:234](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L234)

Build a SARIF 2.1.0 log from a list of findings.

Produces exactly one run. Each finding maps to one SARIF result with its
level mapped directly (`error`/`warning`). The run's rule descriptor list is
de-duplicated by `ruleId`, preserving first-seen order. `page` is mapped onto
a physical-location region; `clause` and `objectRef` are surfaced via the
result property bag.

## Parameters

### findings

readonly [`ValidationFinding`](../interfaces/ValidationFinding.md)[]

The validation findings to serialize.

### toolName?

`string` = `DEFAULT_SARIF_TOOL_NAME`

Optional tool name; defaults to [DEFAULT\_SARIF\_TOOL\_NAME](../variables/DEFAULT_SARIF_TOOL_NAME.md).

## Returns

[`SarifLog`](../interfaces/SarifLog.md)

A SARIF 2.1.0 log.
