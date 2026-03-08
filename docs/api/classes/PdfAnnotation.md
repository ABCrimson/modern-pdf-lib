[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfAnnotation

# Class: PdfAnnotation

Defined in: [src/annotation/pdfAnnotation.ts:225](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L225)

Base class for all PDF annotations.

Wraps a PdfDict representing the annotation dictionary.  Subclasses
add type-specific getters/setters.

## Extended by

- [`PdfTextAnnotation`](PdfTextAnnotation.md)
- [`PdfLinkAnnotation`](PdfLinkAnnotation.md)
- [`PdfFreeTextAnnotation`](PdfFreeTextAnnotation.md)
- [`PdfHighlightAnnotation`](PdfHighlightAnnotation.md)
- [`PdfUnderlineAnnotation`](PdfUnderlineAnnotation.md)
- [`PdfSquigglyAnnotation`](PdfSquigglyAnnotation.md)
- [`PdfStrikeOutAnnotation`](PdfStrikeOutAnnotation.md)
- [`PdfLineAnnotation`](PdfLineAnnotation.md)
- [`PdfSquareAnnotation`](PdfSquareAnnotation.md)
- [`PdfCircleAnnotation`](PdfCircleAnnotation.md)
- [`PdfPolygonAnnotation`](PdfPolygonAnnotation.md)
- [`PdfPolyLineAnnotation`](PdfPolyLineAnnotation.md)
- [`PdfStampAnnotation`](PdfStampAnnotation.md)
- [`PdfInkAnnotation`](PdfInkAnnotation.md)
- [`PdfRedactAnnotation`](PdfRedactAnnotation.md)
- [`PdfPopupAnnotation`](PdfPopupAnnotation.md)
- [`PdfCaretAnnotation`](PdfCaretAnnotation.md)
- [`PdfFileAttachmentAnnotation`](PdfFileAttachmentAnnotation.md)

## Constructors

### Constructor

> **new PdfAnnotation**(`type`, `dict`): `PdfAnnotation`

Defined in: [src/annotation/pdfAnnotation.ts:232](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L232)

#### Parameters

##### type

[`AnnotationType`](../type-aliases/AnnotationType.md)

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfAnnotation`

## Properties

### annotationType

> `readonly` **annotationType**: [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L227)

The annotation subtype.

***

### dict

> `protected` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:230](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L230)

The underlying annotation dictionary.

## Methods

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md) \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:440](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L440)

Generate an appearance stream for this annotation.

The base implementation returns `undefined`.  Subclasses override
to produce proper visual appearance.

#### Returns

[`PdfStream`](PdfStream.md) \| `undefined`

A PdfStream for the /AP /N entry, or undefined.

***

### getAuthor()

> **getAuthor**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L293)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

***

### getColor()

> **getColor**(): \{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:311](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L311)

Get the annotation colour.

#### Returns

\{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

***

### getContents()

> **getContents**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L275)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

***

### getOpacity()

> **getOpacity**(): `number`

Defined in: [src/annotation/pdfAnnotation.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L333)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L251)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

***

### getType()

> **getType**(): [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L242)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

***

### isHidden()

> **isHidden**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:381](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L381)

Whether the annotation is hidden.

#### Returns

`boolean`

***

### isLocked()

> **isLocked**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

***

### isPrintable()

> **isPrintable**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation should be printed.

#### Returns

`boolean`

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:302](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L302)

Set the author.

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setColor()

> **setColor**(`color`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L324)

Set the annotation colour.

#### Parameters

##### color

###### b

`number`

###### g

`number`

###### r

`number`

#### Returns

`void`

***

### setContents()

> **setContents**(`contents`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:284](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L284)

Set the text contents.

#### Parameters

##### contents

`string`

#### Returns

`void`

***

### setHidden()

> **setHidden**(`hidden`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:386](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L386)

Set the hidden flag.

#### Parameters

##### hidden

`boolean`

#### Returns

`void`

***

### setLocked()

> **setLocked**(`locked`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L406)

Set the locked flag.

#### Parameters

##### locked

`boolean`

#### Returns

`void`

***

### setOpacity()

> **setOpacity**(`opacity`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:342](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L342)

Set the annotation opacity.

#### Parameters

##### opacity

`number`

#### Returns

`void`

***

### setPrintable()

> **setPrintable**(`printable`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L396)

Set the print flag.

#### Parameters

##### printable

`boolean`

#### Returns

`void`

***

### setRect()

> **setRect**(`rect`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L266)

Set the annotation rectangle.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

#### Returns

`void`

***

### toDict()

> **toDict**(`registry`): [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:420](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/annotation/pdfAnnotation.ts#L420)

Convert this annotation to a PdfDict suitable for embedding in a PDF.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

The object registry (used to register sub-objects).

#### Returns

[`PdfDict`](PdfDict.md)

The annotation dictionary.
