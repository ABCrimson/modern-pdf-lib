[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStructureTree

# Class: PdfStructureTree

Defined in: [src/accessibility/structureTree.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L391)

The structure tree for a tagged PDF document.

Manages the root `Document` element, assigns marked-content IDs
(MCIDs), and provides serialization to/from PDF dictionaries.

Usage:
```ts
const tree = doc.createStructureTree();
const heading = tree.addElement(null, 'H1', { altText: 'Main heading' });
tree.assignMcid(heading, 0);

const para = tree.addElement(null, 'P');
tree.assignMcid(para, 0);
```

## Constructors

### Constructor

> **new PdfStructureTree**(): `PdfStructureTree`

Defined in: [src/accessibility/structureTree.ts:398](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L398)

#### Returns

`PdfStructureTree`

## Properties

### root

> `readonly` **root**: [`PdfStructureElement`](PdfStructureElement.md)

Defined in: [src/accessibility/structureTree.ts:393](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L393)

The root `Document` structure element.

## Methods

### addElement()

> **addElement**(`parent`, `type`, `options?`): [`PdfStructureElement`](PdfStructureElement.md)

Defined in: [src/accessibility/structureTree.ts:411](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L411)

Add an element to the structure tree.

#### Parameters

##### parent

[`PdfStructureElement`](PdfStructureElement.md) \| `null`

The parent element, or `null` to add directly under
                the root `Document` element.

##### type

[`StructureType`](../type-aliases/StructureType.md)

The structure type of the new element.

##### options?

[`StructureElementOptions`](../interfaces/StructureElementOptions.md)

Optional attributes for the element.

#### Returns

[`PdfStructureElement`](PdfStructureElement.md)

The newly created element.

***

### assignMcid()

> **assignMcid**(`element`, `pageIndex`): `number`

Defined in: [src/accessibility/structureTree.ts:445](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L445)

Assign a marked-content ID to an element and associate it with a
page.  The MCID links the structure element to the actual content
on the page (via BMC/BDC operators in the content stream).

#### Parameters

##### element

[`PdfStructureElement`](PdfStructureElement.md)

The element to assign an MCID to.

##### pageIndex

`number`

The zero-based page index the content appears on.

#### Returns

`number`

The assigned MCID.

***

### getAllElements()

> **getAllElements**(): [`PdfStructureElement`](PdfStructureElement.md)[]

Defined in: [src/accessibility/structureTree.ts:455](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L455)

Return all elements in the tree (depth-first traversal from root).

#### Returns

[`PdfStructureElement`](PdfStructureElement.md)[]

***

### getNextMcid()

> **getNextMcid**(): `number`

Defined in: [src/accessibility/structureTree.ts:462](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L462)

Return the current MCID counter value (useful for testing).

#### Returns

`number`

***

### removeElement()

> **removeElement**(`element`): `void`

Defined in: [src/accessibility/structureTree.ts:426](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L426)

Remove an element from the tree.

#### Parameters

##### element

[`PdfStructureElement`](PdfStructureElement.md)

The element to remove (must not be the root).

#### Returns

`void`

#### Throws

If the element is the root or has no parent.

***

### toDict()

> **toDict**(`registry`, `pageRefs`): `object`

Defined in: [src/accessibility/structureTree.ts:476](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L476)

Serialize the structure tree to a `/StructTreeRoot` dictionary.

The resulting dict is suitable for embedding in the PDF catalog
as `/StructTreeRoot`.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

Object registry for allocating indirect references.

##### pageRefs

readonly [`PdfRef`](PdfRef.md)[]

Array of page references indexed by page number.

#### Returns

`object`

An object containing the StructTreeRoot ref and dict.

##### dict

> **dict**: [`PdfDict`](PdfDict.md)

##### ref

> **ref**: [`PdfRef`](PdfRef.md)

***

### validate()

> **validate**(): [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

Defined in: [src/accessibility/structureTree.ts:749](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L749)

Validate the structure tree for common accessibility issues.

Checks:
- Heading hierarchy (no skipped levels)
- Table structure completeness
- Illustration elements have alt text
- List structure completeness

#### Returns

[`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

An array of [AccessibilityIssue](../interfaces/AccessibilityIssue.md) objects.

***

### fromDict()

> `static` **fromDict**(`dict`, `resolver`): `PdfStructureTree`

Defined in: [src/accessibility/structureTree.ts:620](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/structureTree.ts#L620)

Reconstruct a structure tree from a `/StructTreeRoot` dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The `/StructTreeRoot` dictionary.

##### resolver

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

A function that resolves indirect references to
                 their underlying PDF objects.

#### Returns

`PdfStructureTree`

A new PdfStructureTree.
