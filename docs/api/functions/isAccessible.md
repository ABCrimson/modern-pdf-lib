[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isAccessible

# Function: isAccessible()

> **isAccessible**(`issues`): `boolean`

Defined in: [src/accessibility/accessibilityChecker.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/accessibilityChecker.ts#L320)

Check whether a set of issues contains any errors (severity = "error").

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to check.

## Returns

`boolean`

`true` if there are no errors.
