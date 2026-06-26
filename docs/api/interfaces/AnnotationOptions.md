[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AnnotationOptions

# Interface: AnnotationOptions

Defined in: [src/annotation/pdfAnnotation.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L45)

Options for creating a new annotation.

## Properties

### author?

> `optional` **author?**: `string`

Defined in: [src/annotation/pdfAnnotation.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L51)

Author / title of the annotation.

***

### border?

> `optional` **border?**: `object`

Defined in: [src/annotation/pdfAnnotation.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L61)

Border specification.

#### style?

> `optional` **style?**: `"solid"` \| `"dashed"` \| `"beveled"` \| `"inset"` \| `"underline"`

#### width

> **width**: `number`

***

### color?

> `optional` **color?**: `object`

Defined in: [src/annotation/pdfAnnotation.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L55)

Colour in RGB (each component 0-1).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### contents?

> `optional` **contents?**: `string`

Defined in: [src/annotation/pdfAnnotation.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L49)

Text contents (displayed as tooltip or popup).

***

### flags?

> `optional` **flags?**: `number`

Defined in: [src/annotation/pdfAnnotation.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L59)

Annotation flags bitmask (PDF spec Table 165).

***

### modificationDate?

> `optional` **modificationDate?**: `Date`

Defined in: [src/annotation/pdfAnnotation.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L53)

Last modification date.

***

### opacity?

> `optional` **opacity?**: `number`

Defined in: [src/annotation/pdfAnnotation.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L57)

Opacity (0 = transparent, 1 = opaque).

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L47)

Annotation rectangle [x1, y1, x2, y2] in default user space.
