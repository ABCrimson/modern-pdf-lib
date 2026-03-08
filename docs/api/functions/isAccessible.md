[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isAccessible

# Function: isAccessible()

> **isAccessible**(`issues`): `boolean`

Defined in: [src/accessibility/accessibilityChecker.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/accessibility/accessibilityChecker.ts#L320)

Check whether a set of issues contains any errors (severity = "error").

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to check.

## Returns

`boolean`

`true` if there are no errors.
