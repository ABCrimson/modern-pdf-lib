[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfLayerManager

# Class: PdfLayerManager

Defined in: [src/layers/optionalContent.ts:121](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L121)

Manages a collection of optional content groups (layers) for a PDF
document.

Provides methods to add, remove, and query layers, and to serialize
the `/OCProperties` dictionary that goes into the catalog.

## Constructors

### Constructor

> **new PdfLayerManager**(): `PdfLayerManager`

#### Returns

`PdfLayerManager`

## Methods

### addLayer()

> **addLayer**(`name`, `visible?`): [`PdfLayer`](PdfLayer.md)

Defined in: [src/layers/optionalContent.ts:131](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L131)

Add a new layer.

#### Parameters

##### name

`string`

The display name for the layer.

##### visible?

`boolean` = `true`

Whether the layer is visible by default.

#### Returns

[`PdfLayer`](PdfLayer.md)

The newly created layer.

***

### getLayer()

> **getLayer**(`name`): [`PdfLayer`](PdfLayer.md) \| `undefined`

Defined in: [src/layers/optionalContent.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L143)

Get a layer by name.

#### Parameters

##### name

`string`

The layer name.

#### Returns

[`PdfLayer`](PdfLayer.md) \| `undefined`

The layer, or `undefined` if not found.

***

### getLayers()

> **getLayers**(): [`PdfLayer`](PdfLayer.md)[]

Defined in: [src/layers/optionalContent.ts:152](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L152)

Get all layers.

#### Returns

[`PdfLayer`](PdfLayer.md)[]

A copy of the layers array.

***

### removeLayer()

> **removeLayer**(`name`): `void`

Defined in: [src/layers/optionalContent.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L161)

Remove a layer by name.

#### Parameters

##### name

`string`

The layer name.

#### Returns

`void`

***

### toOCProperties()

> **toOCProperties**(`registry`): [`PdfDict`](PdfDict.md)

Defined in: [src/layers/optionalContent.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L174)

Build the `/OCProperties` dictionary for the document catalog.

This dictionary describes all optional content groups and their
default configurations.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

The PDF object registry.

#### Returns

[`PdfDict`](PdfDict.md)

The `/OCProperties` dictionary (not indirect).

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver`): `PdfLayerManager`

Defined in: [src/layers/optionalContent.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layers/optionalContent.ts#L227)

Parse a PdfLayerManager from an `/OCProperties` dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The `/OCProperties` dictionary from the catalog.

##### resolver

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md)

A function that resolves indirect references.

#### Returns

`PdfLayerManager`

A PdfLayerManager instance.
