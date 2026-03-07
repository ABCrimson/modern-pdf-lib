[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStructureElement

# Class: PdfStructureElement

Defined in: [src/accessibility/structureTree.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L158)

A single node in the structure tree.

Structure elements form a tree that mirrors the logical reading order
of the document.  Each element has a type (e.g. `"P"`, `"H1"`,
`"Table"`), optional attributes, and may contain child elements or
marked-content references (MCIDs) that link to the actual page
content.

## Constructors

### Constructor

> **new PdfStructureElement**(`type`, `options?`): `PdfStructureElement`

Defined in: [src/accessibility/structureTree.ts:181](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L181)

#### Parameters

##### type

[`StructureType`](../type-aliases/StructureType.md)

The structure type (e.g. `"P"`, `"H1"`, `"Figure"`).

##### options?

[`StructureElementOptions`](../interfaces/StructureElementOptions.md) = `{}`

Optional attributes for the element.

#### Returns

`PdfStructureElement`

## Properties

### children

> `readonly` **children**: `PdfStructureElement`[] = `[]`

Defined in: [src/accessibility/structureTree.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L163)

Child structure elements.

***

### mcid?

> `optional` **mcid**: `number`

Defined in: [src/accessibility/structureTree.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L169)

Marked content ID linking this element to page content.

***

### options

> `readonly` **options**: [`StructureElementOptions`](../interfaces/StructureElementOptions.md)

Defined in: [src/accessibility/structureTree.ts:166](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L166)

Optional attributes (alt text, language, title, etc.).

***

### pageIndex?

> `optional` **pageIndex**: `number`

Defined in: [src/accessibility/structureTree.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L172)

Zero-based page index this element's content appears on.

***

### parent?

> `optional` **parent**: `PdfStructureElement`

Defined in: [src/accessibility/structureTree.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L175)

The parent element (undefined for the root).

***

### type

> `readonly` **type**: [`StructureType`](../type-aliases/StructureType.md)

Defined in: [src/accessibility/structureTree.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L160)

The structure type of this element.

## Methods

### addChild()

> **addChild**(`type`, `options?`): `PdfStructureElement`

Defined in: [src/accessibility/structureTree.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L193)

Add a child element to this node.

#### Parameters

##### type

[`StructureType`](../type-aliases/StructureType.md)

The child's structure type.

##### options?

[`StructureElementOptions`](../interfaces/StructureElementOptions.md)

Optional attributes for the child.

#### Returns

`PdfStructureElement`

The newly created child element.

***

### depth()

> **depth**(): `number`

Defined in: [src/accessibility/structureTree.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L257)

Return the depth of this element in the tree (root = 0).

#### Returns

`number`

***

### find()

> **find**(`type`): `PdfStructureElement` \| `undefined`

Defined in: [src/accessibility/structureTree.ts:233](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L233)

Find the first descendant (or self) matching the given type.

#### Parameters

##### type

[`StructureType`](../type-aliases/StructureType.md)

#### Returns

`PdfStructureElement` \| `undefined`

***

### findAll()

> **findAll**(`type`): `PdfStructureElement`[]

Defined in: [src/accessibility/structureTree.ts:245](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L245)

Find all descendants (and self) matching the given type.

#### Parameters

##### type

[`StructureType`](../type-aliases/StructureType.md)

#### Returns

`PdfStructureElement`[]

***

### removeChild()

> **removeChild**(`element`): `void`

Defined in: [src/accessibility/structureTree.ts:209](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L209)

Remove a direct child element.

#### Parameters

##### element

`PdfStructureElement`

The child to remove.

#### Returns

`void`

#### Throws

If the element is not a direct child.

***

### toDict()

> **toDict**(`registry`, `parentRef`, `pageRefs`): `object`

Defined in: [src/accessibility/structureTree.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L275)

Serialize this element to a PDF dictionary.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

Object registry for allocating indirect references.

##### parentRef

[`PdfRef`](PdfRef.md)

Reference to the parent element (or StructTreeRoot).

##### pageRefs

readonly [`PdfRef`](PdfRef.md)[]

Array of page references indexed by page number.

#### Returns

`object`

An object containing the element's dict and its ref.

##### dict

> **dict**: [`PdfDict`](PdfDict.md)

##### ref

> **ref**: [`PdfRef`](PdfRef.md)

***

### walk()

> **walk**(): `PdfStructureElement`[]

Defined in: [src/accessibility/structureTree.ts:222](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/accessibility/structureTree.ts#L222)

Recursively collect all elements in the subtree (depth-first,
including this element).

#### Returns

`PdfStructureElement`[]
