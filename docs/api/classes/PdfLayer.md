[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfLayer

# Class: PdfLayer

Defined in: [src/layers/optionalContent.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L37)

Represents a single optional content group (layer) in a PDF.

Each layer has a name and a default visibility state.  Content
can be associated with a layer using the `BDC`/`EMC` marked-content
operators in the content stream.

## Constructors

### Constructor

> **new PdfLayer**(`name`, `visible?`): `PdfLayer`

Defined in: [src/layers/optionalContent.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L42)

#### Parameters

##### name

`string`

##### visible?

`boolean` = `true`

#### Returns

`PdfLayer`

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/layers/optionalContent.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L38)

## Methods

### getName()

> **getName**(): `string`

Defined in: [src/layers/optionalContent.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L58)

Get the layer name.

#### Returns

`string`

***

### getRef()

> **getRef**(): [`PdfRef`](PdfRef.md) \| `undefined`

Defined in: [src/layers/optionalContent.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L66)

Get the indirect reference for this layer's OCG dictionary.
Only available after `toDict()` has been called.

#### Returns

[`PdfRef`](PdfRef.md) \| `undefined`

***

### isVisible()

> **isVisible**(): `boolean`

Defined in: [src/layers/optionalContent.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L48)

Check whether this layer is visible by default.

#### Returns

`boolean`

***

### setVisible()

> **setVisible**(`visible`): `void`

Defined in: [src/layers/optionalContent.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L53)

Set the default visibility of this layer.

#### Parameters

##### visible

`boolean`

#### Returns

`void`

***

### toDict()

> **toDict**(`registry`): [`PdfRef`](PdfRef.md)

Defined in: [src/layers/optionalContent.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L77)

Serialize this layer as an OCG dictionary and register it in the
object registry.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

The PDF object registry.

#### Returns

[`PdfRef`](PdfRef.md)

The indirect reference to the OCG dictionary.

***

### fromDict()

> `static` **fromDict**(`dict`): `PdfLayer`

Defined in: [src/layers/optionalContent.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/layers/optionalContent.ts#L97)

Parse a PdfLayer from an OCG dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The OCG dictionary.

#### Returns

`PdfLayer`

A PdfLayer instance.
