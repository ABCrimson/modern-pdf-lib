[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SarifResult

# Interface: SarifResult

Defined in: src/compliance/validationReport.ts:112

A single SARIF result — one validation finding.

## Properties

### level

> `readonly` **level**: [`ValidationLevel`](../type-aliases/ValidationLevel.md)

Defined in: src/compliance/validationReport.ts:114

***

### locations?

> `readonly` `optional` **locations?**: readonly `SarifLocation`[]

Defined in: src/compliance/validationReport.ts:116

***

### message

> `readonly` **message**: `SarifMessage`

Defined in: src/compliance/validationReport.ts:115

***

### properties?

> `readonly` `optional` **properties?**: `SarifResultProperties`

Defined in: src/compliance/validationReport.ts:117

***

### ruleId

> `readonly` **ruleId**: `string`

Defined in: src/compliance/validationReport.ts:113
