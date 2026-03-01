[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfOutlineItem

# Class: PdfOutlineItem

Defined in: [src/outline/pdfOutline.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L85)

A single node in the outline tree.  Each item has a title, a
destination, and zero or more child items.

## Constructors

### Constructor

> **new PdfOutlineItem**(`title`, `destination`, `options?`): `PdfOutlineItem`

Defined in: [src/outline/pdfOutline.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L114)

Create a new outline item.

#### Parameters

##### title

`string`

Display title for the bookmark.

##### destination

[`OutlineDestination`](../interfaces/OutlineDestination.md)

Navigation target.

##### options?

[`OutlineItemOptions`](../interfaces/OutlineItemOptions.md)

Visual style options.

#### Returns

`PdfOutlineItem`

## Properties

### bold?

> `optional` **bold**: `boolean`

Defined in: [src/outline/pdfOutline.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L102)

Whether the title is displayed in bold.

***

### children

> **children**: `PdfOutlineItem`[]

Defined in: [src/outline/pdfOutline.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L93)

Child outline items.

***

### color?

> `optional` **color**: `object`

Defined in: [src/outline/pdfOutline.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L99)

Optional colour for the outline text (RGB, 0-1 range).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### destination

> **destination**: [`OutlineDestination`](../interfaces/OutlineDestination.md)

Defined in: [src/outline/pdfOutline.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L90)

Where clicking this bookmark navigates.

***

### isOpen

> **isOpen**: `boolean`

Defined in: [src/outline/pdfOutline.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L96)

Whether children are initially expanded.

***

### italic?

> `optional` **italic**: `boolean`

Defined in: [src/outline/pdfOutline.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L105)

Whether the title is displayed in italic.

***

### title

> **title**: `string`

Defined in: [src/outline/pdfOutline.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L87)

The displayed bookmark title.

## Methods

### addChild()

> **addChild**(`title`, `destination`, `options?`): `PdfOutlineItem`

Defined in: [src/outline/pdfOutline.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L142)

Add a child outline item.

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

`PdfOutlineItem`

The newly created child item.

***

### getVisibleDescendantCount()

> **getVisibleDescendantCount**(): `number`

Defined in: [src/outline/pdfOutline.ts:177](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L177)

Count all visible descendants (for the /Count entry).

Per the PDF spec:
- If the item is open, /Count is the total number of visible
  descendants (children + their visible descendants).
- If the item is closed, /Count is the negative of the total
  number of descendants that *would* be visible if opened.

#### Returns

`number`

The count value for the /Count entry.

***

### removeChild()

> **removeChild**(`item`): `void`

Defined in: [src/outline/pdfOutline.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/outline/pdfOutline.ts#L158)

Remove a child outline item.

#### Parameters

##### item

`PdfOutlineItem`

The child item to remove.

#### Returns

`void`

#### Throws

If the item is not a direct child.
