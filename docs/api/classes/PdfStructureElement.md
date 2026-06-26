[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStructureElement

# Class: PdfStructureElement

Defined in: [src/accessibility/structureTree.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L171)

A single node in the structure tree.

Structure elements form a tree that mirrors the logical reading order
of the document.  Each element has a type (e.g. `"P"`, `"H1"`,
`"Table"`), optional attributes, and may contain child elements or
marked-content references (MCIDs) that link to the actual page
content.

## Constructors

### Constructor

> **new PdfStructureElement**(`type`, `options?`): `PdfStructureElement`

Defined in: [src/accessibility/structureTree.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L194)

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

Defined in: [src/accessibility/structureTree.ts:176](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L176)

Child structure elements.

***

### mcid?

> `optional` **mcid?**: `number`

Defined in: [src/accessibility/structureTree.ts:182](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L182)

Marked content ID linking this element to page content.

***

### options

> `readonly` **options**: [`StructureElementOptions`](../interfaces/StructureElementOptions.md)

Defined in: [src/accessibility/structureTree.ts:179](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L179)

Optional attributes (alt text, language, title, etc.).

***

### pageIndex?

> `optional` **pageIndex?**: `number`

Defined in: [src/accessibility/structureTree.ts:185](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L185)

Zero-based page index this element's content appears on.

***

### parent?

> `optional` **parent?**: `PdfStructureElement`

Defined in: [src/accessibility/structureTree.ts:188](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L188)

The parent element (undefined for the root).

***

### type

> `readonly` **type**: [`StructureType`](../type-aliases/StructureType.md)

Defined in: [src/accessibility/structureTree.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L173)

The structure type of this element.

## Methods

### addChild()

> **addChild**(`type`, `options?`): `PdfStructureElement`

Defined in: [src/accessibility/structureTree.ts:206](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L206)

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

Defined in: [src/accessibility/structureTree.ts:270](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L270)

Return the depth of this element in the tree (root = 0).

#### Returns

`number`

***

### find()

> **find**(`type`): `PdfStructureElement` \| `undefined`

Defined in: [src/accessibility/structureTree.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L246)

Find the first descendant (or self) matching the given type.

#### Parameters

##### type

[`StructureType`](../type-aliases/StructureType.md)

#### Returns

`PdfStructureElement` \| `undefined`

***

### findAll()

> **findAll**(`type`): `PdfStructureElement`[]

Defined in: [src/accessibility/structureTree.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L258)

Find all descendants (and self) matching the given type.

#### Parameters

##### type

[`StructureType`](../type-aliases/StructureType.md)

#### Returns

`PdfStructureElement`[]

***

### removeChild()

> **removeChild**(`element`): `void`

Defined in: [src/accessibility/structureTree.ts:222](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L222)

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

Defined in: [src/accessibility/structureTree.ts:288](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L288)

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

Defined in: [src/accessibility/structureTree.ts:235](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L235)

Recursively collect all elements in the subtree (depth-first,
including this element).

#### Returns

`PdfStructureElement`[]
