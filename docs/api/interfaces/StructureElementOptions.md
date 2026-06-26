[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StructureElementOptions

# Interface: StructureElementOptions

Defined in: [src/accessibility/structureTree.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L77)

Optional attributes for a structure element.

## Properties

### actualText?

> `optional` **actualText?**: `string`

Defined in: [src/accessibility/structureTree.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L83)

Replacement text that may be used instead of the element's content.

***

### altText?

> `optional` **altText?**: `string`

Defined in: [src/accessibility/structureTree.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L81)

Alternative text for the element (required for images by PDF/UA).

***

### artifact?

> `optional` **artifact?**: `boolean`

Defined in: [src/accessibility/structureTree.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L93)

Whether this element is an artifact (decorative, pagination, etc.).
Artifact elements are excluded from accessibility checks such as
alt text requirements.

***

### colSpan?

> `optional` **colSpan?**: `number`

Defined in: [src/accessibility/structureTree.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L109)

Number of columns this cell spans (for TH/TD elements).
Defaults to 1 when not specified.

***

### id?

> `optional` **id?**: `string`

Defined in: [src/accessibility/structureTree.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L87)

An optional unique identifier for the element.

***

### language?

> `optional` **language?**: `string`

Defined in: [src/accessibility/structureTree.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L85)

The natural language for this element (BCP 47, e.g. `"en-US"`).

***

### role?

> `optional` **role?**: `string` & `object` \| `"presentation"`

Defined in: [src/accessibility/structureTree.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L99)

Presentational role hint for the element.  Setting `role` to
`"presentation"` marks the element as layout-only (e.g. a layout
table that should not be treated as a data table).

***

### rowSpan?

> `optional` **rowSpan?**: `number`

Defined in: [src/accessibility/structureTree.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L114)

Number of rows this cell spans (for TH/TD elements).
Defaults to 1 when not specified.

***

### scope?

> `optional` **scope?**: `"Row"` \| `"Column"` \| `"Both"`

Defined in: [src/accessibility/structureTree.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L104)

Header scope for TH cells (`"Row"`, `"Column"`, or `"Both"`).
Used by table header validation.

***

### title?

> `optional` **title?**: `string`

Defined in: [src/accessibility/structureTree.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L79)

The element title (a human-readable label).
