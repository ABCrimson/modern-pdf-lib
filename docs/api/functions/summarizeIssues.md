[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / summarizeIssues

# Function: summarizeIssues()

> **summarizeIssues**(`issues`): `object`

Defined in: [src/accessibility/accessibilityChecker.ts:298](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/accessibility/accessibilityChecker.ts#L298)

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
