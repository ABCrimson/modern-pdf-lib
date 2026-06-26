[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isAccessible

# Function: isAccessible()

```ts
function isAccessible(issues): boolean;
```

Defined in: [src/accessibility/accessibilityChecker.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/accessibilityChecker.ts#L320)

Check whether a set of issues contains any errors (severity = "error").

## Parameters

### issues

readonly [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

The issues to check.

## Returns

`boolean`

`true` if there are no errors.
