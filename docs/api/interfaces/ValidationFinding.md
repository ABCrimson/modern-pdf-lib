[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ValidationFinding

# Interface: ValidationFinding

Defined in: [src/compliance/validationReport.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L38)

A single validation finding produced by a compliance validator.

`ruleId` identifies the rule that was violated (e.g. an ISO clause id or an
internal validator code). `clause`, `page` and `objectRef` are optional
location hints that are mapped into the corresponding report formats.

## Properties

### clause?

```ts
readonly optional clause?: string;
```

Defined in: [src/compliance/validationReport.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L42)

***

### level

```ts
readonly level: ValidationLevel;
```

Defined in: [src/compliance/validationReport.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L41)

***

### message

```ts
readonly message: string;
```

Defined in: [src/compliance/validationReport.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L40)

***

### objectRef?

```ts
readonly optional objectRef?: string;
```

Defined in: [src/compliance/validationReport.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L44)

***

### page?

```ts
readonly optional page?: number;
```

Defined in: [src/compliance/validationReport.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L43)

***

### ruleId

```ts
readonly ruleId: string;
```

Defined in: [src/compliance/validationReport.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L39)
