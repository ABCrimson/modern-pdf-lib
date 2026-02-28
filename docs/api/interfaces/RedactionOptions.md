[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RedactionOptions

# Interface: RedactionOptions

Defined in: [src/core/redaction.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/redaction.ts#L30)

Options for marking a region for redaction.

## Properties

### color?

> `optional` **color**: `object`

Defined in: [src/core/redaction.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/redaction.ts#L36)

Colour for the redaction rectangle (default: black).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### overlayText?

> `optional` **overlayText**: `string`

Defined in: [src/core/redaction.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/redaction.ts#L34)

Optional text to overlay on the redacted area.

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/redaction.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/redaction.ts#L32)

The rectangle to redact: [x, y, width, height].
