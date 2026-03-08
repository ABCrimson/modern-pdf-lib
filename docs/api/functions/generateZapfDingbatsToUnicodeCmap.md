[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateZapfDingbatsToUnicodeCmap

# Function: generateZapfDingbatsToUnicodeCmap()

> **generateZapfDingbatsToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/toUnicodeCmap.ts#L592)

Generate a ToUnicode CMap for the ZapfDingbats font.

The ZapfDingbats font uses its own built-in encoding that maps
character codes to decorative symbols, arrows, and ornaments.

## Returns

`string`

A complete CMap program as a string.
