[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SarifResult

# Interface: SarifResult

Defined in: [src/compliance/validationReport.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L112)

A single SARIF result — one validation finding.

## Properties

### level

```ts
readonly level: ValidationLevel;
```

Defined in: [src/compliance/validationReport.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L114)

***

### locations?

```ts
readonly optional locations?: readonly SarifLocation[];
```

Defined in: [src/compliance/validationReport.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L116)

***

### message

```ts
readonly message: SarifMessage;
```

Defined in: [src/compliance/validationReport.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L115)

***

### properties?

```ts
readonly optional properties?: SarifResultProperties;
```

Defined in: [src/compliance/validationReport.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L117)

***

### ruleId

```ts
readonly ruleId: string;
```

Defined in: [src/compliance/validationReport.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L113)
