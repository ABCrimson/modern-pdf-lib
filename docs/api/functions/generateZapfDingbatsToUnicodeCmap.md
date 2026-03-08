[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateZapfDingbatsToUnicodeCmap

# Function: generateZapfDingbatsToUnicodeCmap()

> **generateZapfDingbatsToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/compliance/toUnicodeCmap.ts#L592)

Generate a ToUnicode CMap for the ZapfDingbats font.

The ZapfDingbats font uses its own built-in encoding that maps
character codes to decorative symbols, arrows, and ornaments.

## Returns

`string`

A complete CMap program as a string.
