[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfOutlineTree

# Class: PdfOutlineTree

Defined in: [src/outline/pdfOutline.ts:214](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L214)

The root of the outline tree, containing top-level outline items.

## Constructors

### Constructor

> **new PdfOutlineTree**(): `PdfOutlineTree`

Defined in: [src/outline/pdfOutline.ts:218](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L218)

#### Returns

`PdfOutlineTree`

## Properties

### items

> **items**: [`PdfOutlineItem`](PdfOutlineItem.md)[]

Defined in: [src/outline/pdfOutline.ts:216](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L216)

Top-level outline items.

## Methods

### addItem()

> **addItem**(`title`, `destination`, `options?`): [`PdfOutlineItem`](PdfOutlineItem.md)

Defined in: [src/outline/pdfOutline.ts:230](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L230)

Add a top-level outline item.

#### Parameters

##### title

`string`

Display title.

##### destination

[`OutlineDestination`](../interfaces/OutlineDestination.md)

Navigation target.

##### options?

[`OutlineItemOptions`](../interfaces/OutlineItemOptions.md)

Visual style options.

#### Returns

[`PdfOutlineItem`](PdfOutlineItem.md)

The newly created item.

***

### removeItem()

> **removeItem**(`item`): `void`

Defined in: [src/outline/pdfOutline.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L246)

Remove a top-level outline item.

#### Parameters

##### item

[`PdfOutlineItem`](PdfOutlineItem.md)

The item to remove.

#### Returns

`void`

#### Throws

If the item is not in the tree.

***

### toDict()

> **toDict**(`registry`, `pageRefs`): [`PdfRef`](PdfRef.md)

Defined in: [src/outline/pdfOutline.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L269)

Serialize the outline tree to a PDF /Outlines dictionary.

This creates the complete outline object graph:
- A root /Outlines dict with /Type, /First, /Last, /Count
- One dict per outline item with /Title, /Parent, /Prev, /Next,
  /First, /Last, /Count, /Dest (or /A), /C, /F

All dictionaries are registered in the provided registry and
cross-linked via indirect references.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

Object registry for allocating refs.

##### pageRefs

readonly [`PdfRef`](PdfRef.md)[]

Array of PdfRef for each page (indexed by page number).

#### Returns

[`PdfRef`](PdfRef.md)

The indirect reference to the /Outlines root dict.

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver`, `pageRefToIndex`): `PdfOutlineTree`

Defined in: [src/outline/pdfOutline.ts:321](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/outline/pdfOutline.ts#L321)

Parse an outline tree from an existing /Outlines dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The /Outlines dictionary.

##### resolver

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

Function to resolve indirect references to objects.

##### pageRefToIndex

`ReadonlyMap`\<`number`, `number`\>

Mapping from page ref object numbers to page indices.

#### Returns

`PdfOutlineTree`

A fully populated PdfOutlineTree.
