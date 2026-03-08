[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateSymbolToUnicodeCmap

# Function: generateSymbolToUnicodeCmap()

> **generateSymbolToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:580](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/toUnicodeCmap.ts#L580)

Generate a ToUnicode CMap for the Symbol font.

The Symbol font uses the Adobe Symbol encoding, which maps
character codes to Greek letters, mathematical symbols, and
other special characters.

## Returns

`string`

A complete CMap program as a string.
