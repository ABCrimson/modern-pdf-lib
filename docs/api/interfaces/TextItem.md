[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextItem

# Interface: TextItem

Defined in: [src/parser/textExtractor.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L31)

A single extracted text item with position and font information.

## Properties

### fontName

> **fontName**: `string`

Defined in: [src/parser/textExtractor.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L45)

Font resource name (e.g. `"/F1"`).

***

### fontSize

> **fontSize**: `number`

Defined in: [src/parser/textExtractor.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L43)

Font size in user-space units.

***

### height

> **height**: `number`

Defined in: [src/parser/textExtractor.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L41)

Approximate height of the text in user-space units (based on font size).

***

### text

> **text**: `string`

Defined in: [src/parser/textExtractor.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L33)

The extracted text string.

***

### width

> **width**: `number`

Defined in: [src/parser/textExtractor.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L39)

Approximate width of the text in user-space units.

***

### x

> **x**: `number`

Defined in: [src/parser/textExtractor.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L35)

Horizontal position in user-space units.

***

### y

> **y**: `number`

Defined in: [src/parser/textExtractor.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/parser/textExtractor.ts#L37)

Vertical position in user-space units.
