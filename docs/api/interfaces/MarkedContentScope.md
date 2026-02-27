[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MarkedContentScope

# Interface: MarkedContentScope

Defined in: [src/accessibility/markedContent.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L31)

Represents a marked-content scope — provides the operator strings
needed to open and close the scope in a content stream.

## Properties

### mcid

> `readonly` **mcid**: `number`

Defined in: [src/accessibility/markedContent.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L33)

The marked-content ID linking to the structure tree.

***

### tag

> `readonly` **tag**: `string`

Defined in: [src/accessibility/markedContent.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L35)

The structure type tag.

## Methods

### begin()

> **begin**(): `string`

Defined in: [src/accessibility/markedContent.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L41)

Return the PDF operator string that begins this marked-content
sequence.  For tagged content with an MCID, this produces a
`BDC` (begin marked-content with properties) operator.

#### Returns

`string`

***

### end()

> **end**(): `string`

Defined in: [src/accessibility/markedContent.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/accessibility/markedContent.ts#L46)

Return the PDF operator string that ends this marked-content
sequence (`EMC`).

#### Returns

`string`
