[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ValidationFinding

# Interface: ValidationFinding

Defined in: src/compliance/validationReport.ts:38

A single validation finding produced by a compliance validator.

`ruleId` identifies the rule that was violated (e.g. an ISO clause id or an
internal validator code). `clause`, `page` and `objectRef` are optional
location hints that are mapped into the corresponding report formats.

## Properties

### clause?

> `readonly` `optional` **clause?**: `string`

Defined in: src/compliance/validationReport.ts:42

***

### level

> `readonly` **level**: [`ValidationLevel`](../type-aliases/ValidationLevel.md)

Defined in: src/compliance/validationReport.ts:41

***

### message

> `readonly` **message**: `string`

Defined in: src/compliance/validationReport.ts:40

***

### objectRef?

> `readonly` `optional` **objectRef?**: `string`

Defined in: src/compliance/validationReport.ts:44

***

### page?

> `readonly` `optional` **page?**: `number`

Defined in: src/compliance/validationReport.ts:43

***

### ruleId

> `readonly` **ruleId**: `string`

Defined in: src/compliance/validationReport.ts:39
