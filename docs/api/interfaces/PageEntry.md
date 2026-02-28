[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PageEntry

# Interface: PageEntry

Defined in: [src/core/pdfCatalog.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L116)

Represents a single page's key refs for building the page tree.

## Properties

### annotationRefs?

> `readonly` `optional` **annotationRefs**: readonly [`PdfRef`](../classes/PdfRef.md)[]

Defined in: [src/core/pdfCatalog.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L145)

Optional annotation indirect references.

***

### artBox?

> `readonly` `optional` **artBox**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfCatalog.ts:141](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L141)

Optional art box `[llx, lly, urx, ury]`.

***

### bleedBox?

> `readonly` `optional` **bleedBox**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfCatalog.ts:139](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L139)

Optional bleed box `[llx, lly, urx, ury]`.

***

### contentStreamRefs

> `readonly` **contentStreamRefs**: [`PdfRef`](../classes/PdfRef.md) \| readonly [`PdfRef`](../classes/PdfRef.md)[]

Defined in: [src/core/pdfCatalog.ts:131](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L131)

Content stream reference(s).

A single PdfRef for newly created pages, or an array for loaded pages
that may have multiple content streams (or original + appended).

***

### cropBox?

> `readonly` `optional` **cropBox**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfCatalog.ts:137](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L137)

Optional crop box `[llx, lly, urx, ury]`.

***

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfCatalog.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L124)

Height of the page (points).

***

### mediaBox?

> `readonly` `optional` **mediaBox**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfCatalog.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L120)

Full media box `[llx, lly, urx, ury]`.

***

### pageRef

> `readonly` **pageRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L118)

Indirect reference for this page object.

***

### resources

> `readonly` **resources**: [`PdfDict`](../classes/PdfDict.md)

Defined in: [src/core/pdfCatalog.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L133)

Resources dictionary (fonts, images, etc.).

***

### rotation?

> `readonly` `optional` **rotation**: `number`

Defined in: [src/core/pdfCatalog.ts:135](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L135)

Optional rotation in degrees (0, 90, 180, 270).

***

### trimBox?

> `readonly` `optional` **trimBox**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: [src/core/pdfCatalog.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L143)

Optional trim box `[llx, lly, urx, ury]`.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfCatalog.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfCatalog.ts#L122)

Width of the page (points).
