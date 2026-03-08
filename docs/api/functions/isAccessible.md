[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isAccessible

# Function: isAccessible()

> **isAccessible**(`issues`): `boolean`

Defined in: [src/accessibility/accessibilityChecker.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/accessibility/accessibilityChecker.ts#L320)

Check whether a set of issues contains any errors (severity = "error").

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to check.

## Returns

`boolean`

`true` if there are no errors.
