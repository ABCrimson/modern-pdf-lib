[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfObjectRegistry

# Class: PdfObjectRegistry

Defined in: [src/core/pdfObjects.ts:461](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L461)

Allocates monotonically increasing object numbers and stores the
mapping from `PdfRef` → object value.

## Constructors

### Constructor

> **new PdfObjectRegistry**(): `PdfObjectRegistry`

#### Returns

`PdfObjectRegistry`

## Accessors

### nextNumber

#### Get Signature

> **get** **nextNumber**(): `number`

Defined in: [src/core/pdfObjects.ts:532](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L532)

The next object number that *would* be assigned.

##### Returns

`number`

***

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [src/core/pdfObjects.ts:527](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L527)

Total number of registered objects (≥ 1 in a valid PDF because of
the free entry at object 0).

##### Returns

`number`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`RegistryEntry`](../interfaces/RegistryEntry.md)\>

Defined in: [src/core/pdfObjects.ts:521](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L521)

Iterate all entries in allocation order.

#### Returns

`IterableIterator`\<[`RegistryEntry`](../interfaces/RegistryEntry.md)\>

***

### allocate()

> **allocate**(): [`PdfRef`](PdfRef.md)

Defined in: [src/core/pdfObjects.ts:497](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L497)

Pre-allocate an object number and return the reference.
Call [assign](#assign) later to attach the actual object.

#### Returns

[`PdfRef`](PdfRef.md)

***

### assign()

> **assign**(`ref`, `object`): `void`

Defined in: [src/core/pdfObjects.ts:504](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L504)

Assign an object to a previously allocated (or registered) reference.

#### Parameters

##### ref

[`PdfRef`](PdfRef.md)

##### object

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`void`

***

### filterReachable()

> **filterReachable**(`rootRefs`): `void`

Defined in: [src/core/pdfObjects.ts:545](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L545)

Remove all registry entries that are not reachable from the given
root references.  This is used after rebuilding the document
structure so that orphaned objects from the original (loaded) PDF
don't bloat the output.

The walk follows every `PdfRef` found inside `PdfDict`, `PdfArray`,
and `PdfStream` objects, handling cycles via a visited set.

#### Parameters

##### rootRefs

[`PdfRef`](PdfRef.md)[]

#### Returns

`void`

***

### register()

> **register**(`object`): [`PdfRef`](PdfRef.md)

Defined in: [src/core/pdfObjects.ts:470](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L470)

Register a new object, allocate an object number, and return its
indirect reference.

#### Parameters

##### object

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

[`PdfRef`](PdfRef.md)

***

### registerWithRef()

> **registerWithRef**(`ref`, `object`): `void`

Defined in: [src/core/pdfObjects.ts:483](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L483)

Register a pre-built `PdfRef` with an object.
Useful when the ref must be known before the object is fully built
(e.g. the catalog references the page tree, and vice-versa).

#### Parameters

##### ref

[`PdfRef`](PdfRef.md)

##### object

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`void`

***

### resolve()

> **resolve**(`ref`): [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

Defined in: [src/core/pdfObjects.ts:516](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L516)

Look up the object for a given reference.

#### Parameters

##### ref

[`PdfRef`](PdfRef.md)

#### Returns

[`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`
