[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AccessibilityIssue

# Interface: AccessibilityIssue

Defined in: [src/accessibility/structureTree.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L124)

Describes a single accessibility issue found during validation.

## Properties

### code

> **code**: `string`

Defined in: [src/accessibility/structureTree.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L128)

Machine-readable issue code.

***

### element?

> `optional` **element?**: [`PdfStructureElement`](../classes/PdfStructureElement.md)

Defined in: [src/accessibility/structureTree.ts:132](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L132)

The structure element related to the issue, if any.

***

### message

> **message**: `string`

Defined in: [src/accessibility/structureTree.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L130)

Human-readable description of the issue.

***

### pageIndex?

> `optional` **pageIndex?**: `number`

Defined in: [src/accessibility/structureTree.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L134)

The zero-based page index related to the issue, if any.

***

### severity

> **severity**: `"error"` \| `"warning"` \| `"info"`

Defined in: [src/accessibility/structureTree.ts:126](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L126)

Severity of the issue.
