[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateZapfDingbatsToUnicodeCmap

# Function: generateZapfDingbatsToUnicodeCmap()

> **generateZapfDingbatsToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/compliance/toUnicodeCmap.ts#L592)

Generate a ToUnicode CMap for the ZapfDingbats font.

The ZapfDingbats font uses its own built-in encoding that maps
character codes to decorative symbols, arrows, and ornaments.

## Returns

`string`

A complete CMap program as a string.
