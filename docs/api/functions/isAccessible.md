[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isAccessible

# Function: isAccessible()

> **isAccessible**(`issues`): `boolean`

Defined in: [src/accessibility/accessibilityChecker.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/accessibility/accessibilityChecker.ts#L320)

Check whether a set of issues contains any errors (severity = "error").

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to check.

## Returns

`boolean`

`true` if there are no errors.
