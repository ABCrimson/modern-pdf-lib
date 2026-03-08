[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateZapfDingbatsToUnicodeCmap

# Function: generateZapfDingbatsToUnicodeCmap()

> **generateZapfDingbatsToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/compliance/toUnicodeCmap.ts#L592)

Generate a ToUnicode CMap for the ZapfDingbats font.

The ZapfDingbats font uses its own built-in encoding that maps
character codes to decorative symbols, arrows, and ornaments.

## Returns

`string`

A complete CMap program as a string.
