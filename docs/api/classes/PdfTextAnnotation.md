[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfTextAnnotation

# Class: PdfTextAnnotation

Defined in: [src/annotation/types/textAnnotation.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L44)

A sticky note annotation (subtype /Text).

Displays a small icon on the page; clicking the icon opens a popup
containing the annotation's text.

## Extends

- [`PdfAnnotation`](PdfAnnotation.md)

## Constructors

### Constructor

> **new PdfTextAnnotation**(`dict`): `PdfTextAnnotation`

Defined in: [src/annotation/types/textAnnotation.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L45)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfTextAnnotation`

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

> **generateAppearance**(): [`PdfStream`](PdfStream.md) \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:440](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L440)

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

### getIcon()

> **getIcon**(): `string`

Defined in: [src/annotation/types/textAnnotation.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L84)

Get the icon name. Defaults to 'Note'.

#### Returns

`string`

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

### isOpen()

> **isOpen**(): `boolean`

Defined in: [src/annotation/types/textAnnotation.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L102)

Whether the popup is initially open.

#### Returns

`boolean`

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

### setIcon()

> **setIcon**(`icon`): `void`

Defined in: [src/annotation/types/textAnnotation.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L93)

Set the icon name.

#### Parameters

##### icon

`string`

#### Returns

`void`

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

### setOpen()

> **setOpen**(`open`): `void`

Defined in: [src/annotation/types/textAnnotation.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L111)

Set the initial open state.

#### Parameters

##### open

`boolean`

#### Returns

`void`

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

> `static` **create**(`options`): `PdfTextAnnotation`

Defined in: [src/annotation/types/textAnnotation.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L52)

Create a new text (sticky note) annotation.

#### Parameters

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md) & `object`

#### Returns

`PdfTextAnnotation`

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver?`): `PdfTextAnnotation`

Defined in: [src/annotation/types/textAnnotation.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/types/textAnnotation.ts#L72)

Create a PdfTextAnnotation from an existing dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

##### resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

#### Returns

`PdfTextAnnotation`
