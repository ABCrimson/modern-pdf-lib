[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SubsetResult

# Interface: SubsetResult

Defined in: [src/assets/font/fontSubset.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/font/fontSubset.ts#L31)

The result of subsetting a font.

## Properties

### fontData

> `readonly` **fontData**: `Uint8Array`

Defined in: [src/assets/font/fontSubset.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/font/fontSubset.ts#L33)

The subsetted font file bytes (TrueType).

***

### newToOldGid

> `readonly` **newToOldGid**: readonly `number`[]

Defined in: [src/assets/font/fontSubset.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/font/fontSubset.ts#L38)

Mapping from new glyph ID (sequential, starting at 0) to original
glyph ID.  Index = new GID, value = old GID.

***

### oldToNewGid

> `readonly` **oldToNewGid**: `ReadonlyMap`\<`number`, `number`\>

Defined in: [src/assets/font/fontSubset.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/font/fontSubset.ts#L43)

Mapping from original glyph ID to new glyph ID.
Only contains entries for glyphs that were retained.
