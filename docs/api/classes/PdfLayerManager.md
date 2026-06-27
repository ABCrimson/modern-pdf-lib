[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfLayerManager

# Class: PdfLayerManager

Defined in: [src/layers/optionalContent.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L120)

Manages a collection of optional content groups (layers) for a PDF
document.

Provides methods to add, remove, and query layers, and to serialize
the `/OCProperties` dictionary that goes into the catalog.

## Constructors

### Constructor

```ts
new PdfLayerManager(): PdfLayerManager;
```

#### Returns

`PdfLayerManager`

## Methods

### addLayer()

```ts
addLayer(name, visible?): PdfLayer;
```

Defined in: [src/layers/optionalContent.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L130)

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

```ts
getLayer(name): PdfLayer | undefined;
```

Defined in: [src/layers/optionalContent.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L142)

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

```ts
getLayers(): PdfLayer[];
```

Defined in: [src/layers/optionalContent.ts:151](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L151)

Get all layers.

#### Returns

[`PdfLayer`](PdfLayer.md)[]

A copy of the layers array.

***

### removeLayer()

```ts
removeLayer(name): void;
```

Defined in: [src/layers/optionalContent.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L160)

Remove a layer by name.

#### Parameters

##### name

`string`

The layer name.

#### Returns

`void`

***

### toOCProperties()

```ts
toOCProperties(registry): PdfDict;
```

Defined in: [src/layers/optionalContent.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L173)

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

```ts
static fromDict(dict, resolver): PdfLayerManager;
```

Defined in: [src/layers/optionalContent.ts:226](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layers/optionalContent.ts#L226)

Parse a PdfLayerManager from an `/OCProperties` dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The `/OCProperties` dictionary from the catalog.

##### resolver

(`ref`) =&gt; [`PdfObject`](../type-aliases/PdfObject.md)

A function that resolves indirect references.

#### Returns

`PdfLayerManager`

A PdfLayerManager instance.
