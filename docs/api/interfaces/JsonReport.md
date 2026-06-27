[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JsonReport

# Interface: JsonReport

Defined in: [src/compliance/validationReport.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L52)

Compact JSON validation report with conformance status and counts.

## Properties

### conformant

```ts
readonly conformant: boolean;
```

Defined in: [src/compliance/validationReport.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L53)

***

### errorCount

```ts
readonly errorCount: number;
```

Defined in: [src/compliance/validationReport.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L54)

***

### findings

```ts
readonly findings: readonly ValidationFinding[];
```

Defined in: [src/compliance/validationReport.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L56)

***

### warningCount

```ts
readonly warningCount: number;
```

Defined in: [src/compliance/validationReport.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/validationReport.ts#L55)
