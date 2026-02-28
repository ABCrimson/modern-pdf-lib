[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfFreeTextAnnotation

# Class: PdfFreeTextAnnotation

Defined in: [src/annotation/types/freeTextAnnotation.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L51)

A free text annotation (subtype /FreeText).

Displays text directly on the page as if it were part of the page
content.  Does not require opening a popup.

## Extends

- [`PdfAnnotation`](PdfAnnotation.md)

## Constructors

### Constructor

> **new PdfFreeTextAnnotation**(`dict`): `PdfFreeTextAnnotation`

Defined in: [src/annotation/types/freeTextAnnotation.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L52)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfFreeTextAnnotation`

#### Overrides

[`PdfAnnotation`](PdfAnnotation.md).[`constructor`](PdfAnnotation.md#constructor)

## Properties

### annotationType

> `readonly` **annotationType**: [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L227)

The annotation subtype.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`annotationType`](PdfAnnotation.md#annotationtype)

***

### dict

> `protected` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:230](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L230)

The underlying annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`dict`](PdfAnnotation.md#dict)

## Methods

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md)

Defined in: [src/annotation/types/freeTextAnnotation.ts:181](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L181)

Generate the appearance stream for this free text annotation.

#### Returns

[`PdfStream`](PdfStream.md)

#### Overrides

[`PdfAnnotation`](PdfAnnotation.md).[`generateAppearance`](PdfAnnotation.md#generateappearance)

***

### getAlignment()

> **getAlignment**(): [`FreeTextAlignment`](../type-aliases/FreeTextAlignment.md)

Defined in: [src/annotation/types/freeTextAnnotation.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L145)

Get the text alignment. Defaults to 'left'.

#### Returns

[`FreeTextAlignment`](../type-aliases/FreeTextAlignment.md)

***

### getAuthor()

> **getAuthor**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L293)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getAuthor`](PdfAnnotation.md#getauthor)

***

### getColor()

> **getColor**(): \{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:311](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L311)

Get the annotation colour.

#### Returns

\{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getColor`](PdfAnnotation.md#getcolor)

***

### getContents()

> **getContents**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L275)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getContents`](PdfAnnotation.md#getcontents)

***

### getDefaultAppearance()

> **getDefaultAppearance**(): `string`

Defined in: [src/annotation/types/freeTextAnnotation.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L163)

Get the default appearance string (/DA).

#### Returns

`string`

***

### getFontSize()

> **getFontSize**(): `number`

Defined in: [src/annotation/types/freeTextAnnotation.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L114)

Get the font size from the default appearance string.

#### Returns

`number`

***

### getOpacity()

> **getOpacity**(): `number`

Defined in: [src/annotation/pdfAnnotation.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L333)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getOpacity`](PdfAnnotation.md#getopacity)

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L251)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getRect`](PdfAnnotation.md#getrect)

***

### getText()

> **getText**(): `string`

Defined in: [src/annotation/types/freeTextAnnotation.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L100)

Get the displayed text.

#### Returns

`string`

***

### getType()

> **getType**(): [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L242)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getType`](PdfAnnotation.md#gettype)

***

### isHidden()

> **isHidden**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:381](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L381)

Whether the annotation is hidden.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isHidden`](PdfAnnotation.md#ishidden)

***

### isLocked()

> **isLocked**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isLocked`](PdfAnnotation.md#islocked)

***

### isPrintable()

> **isPrintable**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation should be printed.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isPrintable`](PdfAnnotation.md#isprintable)

***

### setAlignment()

> **setAlignment**(`align`): `void`

Defined in: [src/annotation/types/freeTextAnnotation.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L154)

Set the text alignment.

#### Parameters

##### align

[`FreeTextAlignment`](../type-aliases/FreeTextAlignment.md)

#### Returns

`void`

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:302](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L302)

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

Defined in: [src/annotation/pdfAnnotation.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L324)

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

Defined in: [src/annotation/pdfAnnotation.ts:284](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L284)

Set the text contents.

#### Parameters

##### contents

`string`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setContents`](PdfAnnotation.md#setcontents)

***

### setDefaultAppearance()

> **setDefaultAppearance**(`da`): `void`

Defined in: [src/annotation/types/freeTextAnnotation.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L172)

Set the default appearance string.

#### Parameters

##### da

`string`

#### Returns

`void`

***

### setFontSize()

> **setFontSize**(`size`): `void`

Defined in: [src/annotation/types/freeTextAnnotation.ts:125](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L125)

Set the font size (rebuilds the default appearance string).

#### Parameters

##### size

`number`

#### Returns

`void`

***

### setHidden()

> **setHidden**(`hidden`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:386](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L386)

Set the hidden flag.

#### Parameters

##### hidden

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setHidden`](PdfAnnotation.md#sethidden)

***

### setLocked()

> **setLocked**(`locked`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L406)

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

Defined in: [src/annotation/pdfAnnotation.ts:342](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L342)

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

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L396)

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

Defined in: [src/annotation/pdfAnnotation.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L266)

Set the annotation rectangle.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setRect`](PdfAnnotation.md#setrect)

***

### setText()

> **setText**(`text`): `void`

Defined in: [src/annotation/types/freeTextAnnotation.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L105)

Set the displayed text.

#### Parameters

##### text

`string`

#### Returns

`void`

***

### toDict()

> **toDict**(`registry`): [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:420](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L420)

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

> `static` **create**(`options`): `PdfFreeTextAnnotation`

Defined in: [src/annotation/types/freeTextAnnotation.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L59)

Create a new free text annotation.

#### Parameters

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md) & `object`

#### Returns

`PdfFreeTextAnnotation`

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver?`): `PdfFreeTextAnnotation`

Defined in: [src/annotation/types/freeTextAnnotation.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/freeTextAnnotation.ts#L88)

Create from an existing dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

##### resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

#### Returns

`PdfFreeTextAnnotation`
