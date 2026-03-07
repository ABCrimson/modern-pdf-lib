[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfLinkAnnotation

# Class: PdfLinkAnnotation

Defined in: [src/annotation/types/linkAnnotation.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L38)

A link annotation (subtype /Link).

Provides navigation to a destination within the document or to an
external URI.

## Extends

- [`PdfAnnotation`](PdfAnnotation.md)

## Constructors

### Constructor

> **new PdfLinkAnnotation**(`dict`): `PdfLinkAnnotation`

Defined in: [src/annotation/types/linkAnnotation.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L39)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfLinkAnnotation`

#### Overrides

[`PdfAnnotation`](PdfAnnotation.md).[`constructor`](PdfAnnotation.md#constructor)

## Properties

### annotationType

> `readonly` **annotationType**: [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L227)

The annotation subtype.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`annotationType`](PdfAnnotation.md#annotationtype)

***

### dict

> `protected` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:230](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L230)

The underlying annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`dict`](PdfAnnotation.md#dict)

## Methods

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md) \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:440](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L440)

Generate an appearance stream for this annotation.

The base implementation returns `undefined`.  Subclasses override
to produce proper visual appearance.

#### Returns

[`PdfStream`](PdfStream.md) \| `undefined`

A PdfStream for the /AP /N entry, or undefined.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`generateAppearance`](PdfAnnotation.md#generateappearance)

***

### getAuthor()

> **getAuthor**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L293)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getAuthor`](PdfAnnotation.md#getauthor)

***

### getColor()

> **getColor**(): \{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:311](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L311)

Get the annotation colour.

#### Returns

\{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getColor`](PdfAnnotation.md#getcolor)

***

### getContents()

> **getContents**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L275)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getContents`](PdfAnnotation.md#getcontents)

***

### getDestination()

> **getDestination**(): `string` \| \[`number`, `string`, `...number[]`\] \| `undefined`

Defined in: [src/annotation/types/linkAnnotation.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L90)

Get the destination (named dest string or explicit dest array).

Returns:
- A string for named destinations.
- An array `[pageIndex, fitMode, ...params]` for explicit destinations.
- `undefined` if no destination is set.

#### Returns

`string` \| \[`number`, `string`, `...number[]`\] \| `undefined`

***

### getHighlightMode()

> **getHighlightMode**(): [`LinkHighlightMode`](../type-aliases/LinkHighlightMode.md)

Defined in: [src/annotation/types/linkAnnotation.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L159)

Get the highlight mode. Defaults to 'Invert'.

#### Returns

[`LinkHighlightMode`](../type-aliases/LinkHighlightMode.md)

***

### getOpacity()

> **getOpacity**(): `number`

Defined in: [src/annotation/pdfAnnotation.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L333)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getOpacity`](PdfAnnotation.md#getopacity)

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L251)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getRect`](PdfAnnotation.md#getrect)

***

### getType()

> **getType**(): [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L242)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getType`](PdfAnnotation.md#gettype)

***

### getUrl()

> **getUrl**(): `string` \| `undefined`

Defined in: [src/annotation/types/linkAnnotation.ts:135](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L135)

Get the URL if this is a URI link.

#### Returns

`string` \| `undefined`

***

### isHidden()

> **isHidden**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:381](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L381)

Whether the annotation is hidden.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isHidden`](PdfAnnotation.md#ishidden)

***

### isLocked()

> **isLocked**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isLocked`](PdfAnnotation.md#islocked)

***

### isPrintable()

> **isPrintable**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation should be printed.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isPrintable`](PdfAnnotation.md#isprintable)

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:302](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L302)

Set the author.

#### Parameters

##### author

`string`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setAuthor`](PdfAnnotation.md#setauthor)

***

### setColor()

> **setColor**(`color`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L324)

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

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setColor`](PdfAnnotation.md#setcolor)

***

### setContents()

> **setContents**(`contents`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:284](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L284)

Set the text contents.

#### Parameters

##### contents

`string`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setContents`](PdfAnnotation.md#setcontents)

***

### setDestination()

> **setDestination**(`pageIndex`, `fit?`): `void`

Defined in: [src/annotation/types/linkAnnotation.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L122)

Set an explicit destination (page index + fit mode).

#### Parameters

##### pageIndex

`number`

Zero-based page index.

##### fit?

`string`

Fit mode (defaults to 'Fit').

#### Returns

`void`

***

### setHidden()

> **setHidden**(`hidden`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:386](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L386)

Set the hidden flag.

#### Parameters

##### hidden

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setHidden`](PdfAnnotation.md#sethidden)

***

### setHighlightMode()

> **setHighlightMode**(`mode`): `void`

Defined in: [src/annotation/types/linkAnnotation.ts:179](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L179)

Set the highlight mode.

#### Parameters

##### mode

[`LinkHighlightMode`](../type-aliases/LinkHighlightMode.md)

#### Returns

`void`

***

### setLocked()

> **setLocked**(`locked`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L406)

Set the locked flag.

#### Parameters

##### locked

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setLocked`](PdfAnnotation.md#setlocked)

***

### setOpacity()

> **setOpacity**(`opacity`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:342](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L342)

Set the annotation opacity.

#### Parameters

##### opacity

`number`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setOpacity`](PdfAnnotation.md#setopacity)

***

### setPrintable()

> **setPrintable**(`printable`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L396)

Set the print flag.

#### Parameters

##### printable

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setPrintable`](PdfAnnotation.md#setprintable)

***

### setRect()

> **setRect**(`rect`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L266)

Set the annotation rectangle.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setRect`](PdfAnnotation.md#setrect)

***

### setUrl()

> **setUrl**(`url`): `void`

Defined in: [src/annotation/types/linkAnnotation.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L147)

Set the URL (creates a /URI action).

#### Parameters

##### url

`string`

#### Returns

`void`

***

### toDict()

> **toDict**(`registry`): [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:420](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/pdfAnnotation.ts#L420)

Convert this annotation to a PdfDict suitable for embedding in a PDF.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

The object registry (used to register sub-objects).

#### Returns

[`PdfDict`](PdfDict.md)

The annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`toDict`](PdfAnnotation.md#todict)

***

### create()

> `static` **create**(`options`): `PdfLinkAnnotation`

Defined in: [src/annotation/types/linkAnnotation.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L46)

Create a new link annotation.

#### Parameters

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md) & `object`

#### Returns

`PdfLinkAnnotation`

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver?`): `PdfLinkAnnotation`

Defined in: [src/annotation/types/linkAnnotation.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/annotation/types/linkAnnotation.ts#L71)

Create from an existing dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

##### resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

#### Returns

`PdfLinkAnnotation`
