[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / summarizeIssues

# Function: summarizeIssues()

```ts
function summarizeIssues(issues): object;
```

Defined in: [src/accessibility/accessibilityChecker.ts:298](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/accessibilityChecker.ts#L298)

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
