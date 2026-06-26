[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPopupAnnotation

# Class: PdfPopupAnnotation

Defined in: [src/annotation/types/popupAnnotation.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L32)

A popup annotation (subtype /Popup).

Displays a floating window containing the text of its parent
annotation. The parent annotation references this popup via its
`/Popup` entry, and this popup references its parent via `/Parent`.

## Extends

- [`PdfAnnotation`](PdfAnnotation.md)

## Constructors

### Constructor

> **new PdfPopupAnnotation**(`dict`): `PdfPopupAnnotation`

Defined in: [src/annotation/types/popupAnnotation.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L33)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfPopupAnnotation`

#### Overrides

[`PdfAnnotation`](PdfAnnotation.md).[`constructor`](PdfAnnotation.md#constructor)

## Properties

### annotationType

> `readonly` **annotationType**: [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L237)

The annotation subtype.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`annotationType`](PdfAnnotation.md#annotationtype)

***

### dict

> `protected` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L240)

The underlying annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`dict`](PdfAnnotation.md#dict)

## Methods

### generateAppearance()

> **generateAppearance**(): [`PdfStream`](PdfStream.md) \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:450](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L450)

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

Defined in: [src/annotation/pdfAnnotation.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L303)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getAuthor`](PdfAnnotation.md#getauthor)

***

### getColor()

> **getColor**(): \{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:321](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L321)

Get the annotation colour.

#### Returns

\{ `b`: `number`; `g`: `number`; `r`: `number`; \} \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getColor`](PdfAnnotation.md#getcolor)

***

### getContents()

> **getContents**(): `string` \| `undefined`

Defined in: [src/annotation/pdfAnnotation.ts:285](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L285)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getContents`](PdfAnnotation.md#getcontents)

***

### getOpacity()

> **getOpacity**(): `number`

Defined in: [src/annotation/pdfAnnotation.ts:343](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L343)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getOpacity`](PdfAnnotation.md#getopacity)

***

### getParent()

> **getParent**(): [`PdfRef`](PdfRef.md) \| `undefined`

Defined in: [src/annotation/types/popupAnnotation.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L96)

Get the parent annotation reference, if set.

#### Returns

[`PdfRef`](PdfRef.md) \| `undefined`

***

### getRect()

> **getRect**(): \[`number`, `number`, `number`, `number`\]

Defined in: [src/annotation/pdfAnnotation.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L261)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getRect`](PdfAnnotation.md#getrect)

***

### getType()

> **getType**(): [`AnnotationType`](../type-aliases/AnnotationType.md)

Defined in: [src/annotation/pdfAnnotation.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L252)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getType`](PdfAnnotation.md#gettype)

***

### isHidden()

> **isHidden**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation is hidden.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isHidden`](PdfAnnotation.md#ishidden)

***

### isLocked()

> **isLocked**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:411](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L411)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isLocked`](PdfAnnotation.md#islocked)

***

### isOpen()

> **isOpen**(): `boolean`

Defined in: [src/annotation/types/popupAnnotation.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L70)

Whether the popup is initially open.

#### Returns

`boolean`

***

### isPrintable()

> **isPrintable**(): `boolean`

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation should be printed.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isPrintable`](PdfAnnotation.md#isprintable)

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L312)

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

Defined in: [src/annotation/pdfAnnotation.ts:334](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L334)

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

Defined in: [src/annotation/pdfAnnotation.ts:294](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L294)

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

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L396)

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

Defined in: [src/annotation/pdfAnnotation.ts:416](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L416)

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

Defined in: [src/annotation/pdfAnnotation.ts:352](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L352)

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

Defined in: [src/annotation/types/popupAnnotation.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L79)

Set the initial open state.

#### Parameters

##### open

`boolean`

#### Returns

`void`

***

### setParent()

> **setParent**(`parentRef`): `void`

Defined in: [src/annotation/types/popupAnnotation.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L91)

Set the parent annotation reference.
The parent is the annotation whose text this popup displays.

#### Parameters

##### parentRef

[`PdfRef`](PdfRef.md)

#### Returns

`void`

***

### setPrintable()

> **setPrintable**(`printable`): `void`

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L406)

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

Defined in: [src/annotation/pdfAnnotation.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L276)

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

Defined in: [src/annotation/pdfAnnotation.ts:430](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L430)

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

> `static` **create**(`options`): `PdfPopupAnnotation`

Defined in: [src/annotation/types/popupAnnotation.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L42)

Create a new popup annotation.

#### Parameters

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md) & `object`

#### Returns

`PdfPopupAnnotation`

***

### fromDict()

> `static` **fromDict**(`dict`, `_resolver?`): `PdfPopupAnnotation`

Defined in: [src/annotation/types/popupAnnotation.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/types/popupAnnotation.ts#L58)

Create a PdfPopupAnnotation from an existing dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

##### \_resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

#### Returns

`PdfPopupAnnotation`
