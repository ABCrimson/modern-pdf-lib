[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / summarizeIssues

# Function: summarizeIssues()

> **summarizeIssues**(`issues`): `object`

Defined in: [src/accessibility/accessibilityChecker.ts:298](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/accessibilityChecker.ts#L298)

Generate a summary of accessibility issues by severity.

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to summarize.

## Returns

`object`

An object with counts per severity level.

### errors

> **errors**: `number`

### infos

> **infos**: `number`

### total

> **total**: `number`

### warnings

> **warnings**: `number`
