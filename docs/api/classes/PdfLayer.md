[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfLayer

# Class: PdfLayer

Defined in: [src/layers/optionalContent.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L36)

Represents a single optional content group (layer) in a PDF.

Each layer has a name and a default visibility state.  Content
can be associated with a layer using the `BDC`/`EMC` marked-content
operators in the content stream.

## Constructors

### Constructor

> **new PdfLayer**(`name`, `visible?`): `PdfLayer`

Defined in: [src/layers/optionalContent.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L41)

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

Defined in: [src/layers/optionalContent.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L37)

## Methods

### getName()

> **getName**(): `string`

Defined in: [src/layers/optionalContent.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L57)

Get the layer name.

#### Returns

`string`

***

### getRef()

> **getRef**(): [`PdfRef`](PdfRef.md) \| `undefined`

Defined in: [src/layers/optionalContent.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L65)

Get the indirect reference for this layer's OCG dictionary.
Only available after `toDict()` has been called.

#### Returns

[`PdfRef`](PdfRef.md) \| `undefined`

***

### isVisible()

> **isVisible**(): `boolean`

Defined in: [src/layers/optionalContent.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L47)

Check whether this layer is visible by default.

#### Returns

`boolean`

***

### setVisible()

> **setVisible**(`visible`): `void`

Defined in: [src/layers/optionalContent.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L52)

Set the default visibility of this layer.

#### Parameters

##### visible

`boolean`

#### Returns

`void`

***

### toDict()

> **toDict**(`registry`): [`PdfRef`](PdfRef.md)

Defined in: [src/layers/optionalContent.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L76)

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

Defined in: [src/layers/optionalContent.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layers/optionalContent.ts#L96)

Parse a PdfLayer from an OCG dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The OCG dictionary.

#### Returns

`PdfLayer`

A PdfLayer instance.
