[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RedactionOptions

# Interface: RedactionOptions

Defined in: [src/core/redaction.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L33)

Options for marking a region for redaction.

## Properties

### borderColor?

> `optional` **borderColor?**: `object`

Defined in: [src/core/redaction.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L49)

Border colour (default: same as fill colour).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### borderWidth?

> `optional` **borderWidth?**: `number`

Defined in: [src/core/redaction.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L47)

Border width for the redaction rectangle outline (default: 0 — no border).

***

### color?

> `optional` **color?**: `object`

Defined in: [src/core/redaction.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L39)

Colour for the redaction rectangle (default: black).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### opacity?

> `optional` **opacity?**: `number`

Defined in: [src/core/redaction.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L51)

Opacity for the redaction overlay, 0–1 (default: 1 — fully opaque). Useful for preview/draft mode.

***

### overlayAlignment?

> `optional` **overlayAlignment?**: `OverlayAlignment`

Defined in: [src/core/redaction.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L45)

Horizontal alignment for overlay text (default: 'left').

***

### overlayFont?

> `optional` **overlayFont?**: `string`

Defined in: [src/core/redaction.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L41)

Custom font name for overlay text (default: 'Helvetica').

***

### overlayFontSize?

> `optional` **overlayFontSize?**: `number`

Defined in: [src/core/redaction.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L43)

Custom font size for overlay text. When omitted, auto-calculated from rect height.

***

### overlayText?

> `optional` **overlayText?**: `string`

Defined in: [src/core/redaction.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L37)

Optional text to overlay on the redacted area.

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/redaction.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/redaction.ts#L35)

The rectangle to redact: [x, y, width, height].
