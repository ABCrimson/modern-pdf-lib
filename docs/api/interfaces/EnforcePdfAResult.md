[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EnforcePdfAResult

# Interface: EnforcePdfAResult

Defined in: [src/compliance/enforcePdfAv2.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L49)

Result of the enhanced PDF/A enforcement.

## Properties

### actions

```ts
readonly actions: EnforcementAction[];
```

Defined in: [src/compliance/enforcePdfAv2.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L55)

Actions taken during enforcement.

***

### bytes

```ts
readonly bytes: Uint8Array;
```

Defined in: [src/compliance/enforcePdfAv2.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L51)

Modified PDF bytes.

***

### fullyCompliant

```ts
readonly fullyCompliant: boolean;
```

Defined in: [src/compliance/enforcePdfAv2.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L57)

Whether all errors were resolved.

***

### remainingIssues

```ts
readonly remainingIssues: number;
```

Defined in: [src/compliance/enforcePdfAv2.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L59)

Remaining error-level issues (if any).

***

### validation

```ts
readonly validation: PdfAValidationResult;
```

Defined in: [src/compliance/enforcePdfAv2.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L53)

Validation result after enforcement.
