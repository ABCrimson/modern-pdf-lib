[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / checkAccessibility

# Function: checkAccessibility()

> **checkAccessibility**(`doc`): [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

Defined in: [src/accessibility/accessibilityChecker.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/accessibility/accessibilityChecker.ts#L62)

Check a PDF document for accessibility issues.

This function examines the document's structure tree, metadata, and
page content to identify potential accessibility problems.  It returns
an array of [AccessibilityIssue](../interfaces/AccessibilityIssue.md) objects, each describing a
specific issue with its severity, code, and human-readable message.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PDF document to check.

## Returns

[`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

An array of accessibility issues (empty if no issues found).

## Example

```ts
import { createPdf } from 'modern-pdf-lib';
import { checkAccessibility } from 'modern-pdf-lib/accessibility';

const doc = createPdf();
const issues = checkAccessibility(doc);
for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}
```
