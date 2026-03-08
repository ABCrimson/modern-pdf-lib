[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AnnotationOptions

# Interface: AnnotationOptions

Defined in: [src/annotation/pdfAnnotation.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L46)

Options for creating a new annotation.

## Properties

### author?

> `optional` **author**: `string`

Defined in: [src/annotation/pdfAnnotation.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L52)

Author / title of the annotation.

***

### border?

> `optional` **border**: `object`

Defined in: [src/annotation/pdfAnnotation.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L62)

Border specification.

#### style?

> `optional` **style**: `"solid"` \| `"dashed"` \| `"beveled"` \| `"inset"` \| `"underline"`

#### width

> **width**: `number`

***

### color?

> `optional` **color**: `object`

Defined in: [src/annotation/pdfAnnotation.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L56)

Colour in RGB (each component 0-1).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### contents?

> `optional` **contents**: `string`

Defined in: [src/annotation/pdfAnnotation.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L50)

Text contents (displayed as tooltip or popup).

***

### flags?

> `optional` **flags**: `number`

Defined in: [src/annotation/pdfAnnotation.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L60)

Annotation flags bitmask (PDF spec Table 165).

***

### modificationDate?

> `optional` **modificationDate**: `Date`

Defined in: [src/annotation/pdfAnnotation.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L54)

Last modification date.

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/annotation/pdfAnnotation.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L58)

Opacity (0 = transparent, 1 = opaque).

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L48)

Annotation rectangle [x1, y1, x2, y2] in default user space.
