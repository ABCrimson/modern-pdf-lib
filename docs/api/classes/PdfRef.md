[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfRef

# Class: PdfRef

Defined in: [src/core/pdfObjects.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L391)

An indirect reference `N G R`.

## Constructors

### Constructor

> **new PdfRef**(`objectNumber`, `generationNumber?`): `PdfRef`

Defined in: [src/core/pdfObjects.ts:395](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L395)

#### Parameters

##### objectNumber

`number`

Object number (≥ 1).

##### generationNumber?

`number` = `0`

Generation number (usually 0).

#### Returns

`PdfRef`

## Properties

### generationNumber

> `readonly` **generationNumber**: `number` = `0`

Defined in: [src/core/pdfObjects.ts:399](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L399)

Generation number (usually 0).

***

### objectNumber

> `readonly` **objectNumber**: `number`

Defined in: [src/core/pdfObjects.ts:397](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L397)

Object number (≥ 1).

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:407](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L407)

The string form used inside PDF bodies: `N G R`.

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### toObjectFooter()

> **toObjectFooter**(): `string`

Defined in: [src/core/pdfObjects.ts:417](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L417)

Return `endobj`.

#### Returns

`string`

***

### toObjectHeader()

> **toObjectHeader**(): `string`

Defined in: [src/core/pdfObjects.ts:412](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L412)

Return the `N G obj` header for an indirect-object definition.

#### Returns

`string`

***

### toString()

> **toString**(): `string`

Defined in: [src/core/pdfObjects.ts:421](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L421)

#### Returns

`string`

***

### of()

> `static` **of**(`objectNumber`, `generationNumber?`): `PdfRef`

Defined in: [src/core/pdfObjects.ts:402](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L402)

#### Parameters

##### objectNumber

`number`

##### generationNumber?

`number` = `0`

#### Returns

`PdfRef`
