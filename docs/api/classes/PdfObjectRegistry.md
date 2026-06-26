[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfObjectRegistry

# Class: PdfObjectRegistry

Defined in: [src/core/pdfObjects.ts:471](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L471)

Allocates monotonically increasing object numbers and stores the
mapping from `PdfRef` → object value.

## Constructors

### Constructor

```ts
new PdfObjectRegistry(): PdfObjectRegistry;
```

#### Returns

`PdfObjectRegistry`

## Accessors

### nextNumber

#### Get Signature

```ts
get nextNumber(): number;
```

Defined in: [src/core/pdfObjects.ts:542](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L542)

The next object number that *would* be assigned.

##### Returns

`number`

***

### size

#### Get Signature

```ts
get size(): number;
```

Defined in: [src/core/pdfObjects.ts:537](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L537)

Total number of registered objects (≥ 1 in a valid PDF because of
the free entry at object 0).

##### Returns

`number`

## Methods

### \[iterator\]()

```ts
iterator: IterableIterator<RegistryEntry>;
```

Defined in: [src/core/pdfObjects.ts:531](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L531)

Iterate all entries in allocation order.

#### Returns

`IterableIterator`\&lt;[`RegistryEntry`](../interfaces/RegistryEntry.md)\&gt;

***

### allocate()

```ts
allocate(): PdfRef;
```

Defined in: [src/core/pdfObjects.ts:507](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L507)

Pre-allocate an object number and return the reference.
Call [assign](#assign) later to attach the actual object.

#### Returns

[`PdfRef`](PdfRef.md)

***

### assign()

```ts
assign(ref, object): void;
```

Defined in: [src/core/pdfObjects.ts:514](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L514)

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

```ts
filterReachable(rootRefs): void;
```

Defined in: [src/core/pdfObjects.ts:555](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L555)

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

```ts
register(object): PdfRef;
```

Defined in: [src/core/pdfObjects.ts:480](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L480)

Register a new object, allocate an object number, and return its
indirect reference.

#### Parameters

##### object

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

[`PdfRef`](PdfRef.md)

***

### registerWithRef()

```ts
registerWithRef(ref, object): void;
```

Defined in: [src/core/pdfObjects.ts:493](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L493)

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

```ts
resolve(ref): PdfObject | undefined;
```

Defined in: [src/core/pdfObjects.ts:526](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L526)

Look up the object for a given reference.

#### Parameters

##### ref

[`PdfRef`](PdfRef.md)

#### Returns

[`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`
