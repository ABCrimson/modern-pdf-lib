[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AccessibilityIssue

# Interface: AccessibilityIssue

Defined in: [src/accessibility/structureTree.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L97)

Describes a single accessibility issue found during validation.

## Properties

### code

> **code**: `string`

Defined in: [src/accessibility/structureTree.ts:101](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L101)

Machine-readable issue code.

***

### element?

> `optional` **element**: [`PdfStructureElement`](../classes/PdfStructureElement.md)

Defined in: [src/accessibility/structureTree.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L105)

The structure element related to the issue, if any.

***

### message

> **message**: `string`

Defined in: [src/accessibility/structureTree.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L103)

Human-readable description of the issue.

***

### pageIndex?

> `optional` **pageIndex**: `number`

Defined in: [src/accessibility/structureTree.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L107)

The zero-based page index related to the issue, if any.

***

### severity

> **severity**: `"error"` \| `"warning"` \| `"info"`

Defined in: [src/accessibility/structureTree.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L99)

Severity of the issue.
