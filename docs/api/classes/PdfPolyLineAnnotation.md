[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPolyLineAnnotation

# Class: PdfPolyLineAnnotation

Defined in: [src/annotation/types/shapeAnnotations.ts:328](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/types/shapeAnnotations.ts#L328)

PolyLine annotation (subtype /PolyLine).

Draws an open polyline (series of connected line segments).

## Extends

- [`PdfAnnotation`](PdfAnnotation.md)

## Constructors

### Constructor

> **new PdfPolyLineAnnotation**(`dict`): `PdfPolyLineAnnotation`

Defined in: [src/annotation/types/shapeAnnotations.ts:329](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/types/shapeAnnotations.ts#L329)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfPolyLineAnnotation`

#### Overrides

[`PdfAnnotation`](PdfAnnotation.md).[`constructor`](PdfAnnotation.md#constructor)

## Properties

### annotationType

> `readonly` **annotationType**: [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L227)

The annotation subtype.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`annotationType`](PdfAnnotation.md#annotationtype)

***

### dict

> `protected` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:230](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L230)

The underlying annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`dict`](PdfAnnotation.md#dict)

## Methods

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md) \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:440](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L440)

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

Defined in: [src/annotation/pdfAnnotation.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L293)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getAuthor`](PdfAnnotation.md#getauthor)

***

### getColor()

> **getColor**(): \{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:311](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L311)

Get the annotation colour.

#### Returns

\{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getColor`](PdfAnnotation.md#getcolor)

***

### getContents()

> **getContents**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L275)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getContents`](PdfAnnotation.md#getcontents)

***

### getOpacity()

> **getOpacity**(): `number`

Defined in: [src/annotation/pdfAnnotation.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L333)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getOpacity`](PdfAnnotation.md#getopacity)

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L251)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getRect`](PdfAnnotation.md#getrect)

***

### getType()

> **getType**(): [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L242)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getType`](PdfAnnotation.md#gettype)

***

### getVertices()

> **getVertices**(): `number`[]

Defined in: [src/annotation/types/shapeAnnotations.ts:354](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/types/shapeAnnotations.ts#L354)

Get the polyline vertices as a flat array [x1,y1,x2,y2,...].

#### Returns

`number`[]

***

### isHidden()

> **isHidden**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:381](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L381)

Whether the annotation is hidden.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isHidden`](PdfAnnotation.md#ishidden)

***

### isLocked()

> **isLocked**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isLocked`](PdfAnnotation.md#islocked)

***

### isPrintable()

> **isPrintable**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation should be printed.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isPrintable`](PdfAnnotation.md#isprintable)

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:302](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L302)

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

Defined in: [src/annotation/pdfAnnotation.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L324)

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

Defined in: [src/annotation/pdfAnnotation.ts:284](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L284)

Set the text contents.

#### Parameters

##### contents

`string`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setContents`](PdfAnnotation.md#setcontents)

***

### setHidden()

> **setHidden**(`hidden`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:386](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L386)

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

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L406)

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

Defined in: [src/annotation/pdfAnnotation.ts:342](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L342)

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

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L396)

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

Defined in: [src/annotation/pdfAnnotation.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L266)

Set the annotation rectangle.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setRect`](PdfAnnotation.md#setrect)

***

### setVertices()

> **setVertices**(`vertices`): `void`

Defined in: [src/annotation/types/shapeAnnotations.ts:365](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/types/shapeAnnotations.ts#L365)

Set the polyline vertices.

#### Parameters

##### vertices

`number`[]

#### Returns

`void`

***

### toDict()

> **toDict**(`registry`): [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:420](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/pdfAnnotation.ts#L420)

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

> `static` **create**(`options`): `PdfPolyLineAnnotation`

Defined in: [src/annotation/types/shapeAnnotations.ts:333](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/types/shapeAnnotations.ts#L333)

#### Parameters

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md) & `object`

#### Returns

`PdfPolyLineAnnotation`

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver?`): `PdfPolyLineAnnotation`

Defined in: [src/annotation/types/shapeAnnotations.ts:346](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/annotation/types/shapeAnnotations.ts#L346)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

##### resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

#### Returns

`PdfPolyLineAnnotation`
