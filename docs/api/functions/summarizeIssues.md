[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / summarizeIssues

# Function: summarizeIssues()

```ts
function summarizeIssues(issues): object;
```

Defined in: [src/accessibility/accessibilityChecker.ts:298](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/accessibilityChecker.ts#L298)

Generate a summary of accessibility issues by severity.

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to summarize.

## Returns

`object`

An object with counts per severity level.

### errors

```ts
errors: number;
```

### infos

```ts
infos: number;
```

### total

```ts
total: number;
```

### warnings

```ts
warnings: number;
```
