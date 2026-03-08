[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateSymbolToUnicodeCmap

# Function: generateSymbolToUnicodeCmap()

> **generateSymbolToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:580](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/toUnicodeCmap.ts#L580)

Generate a ToUnicode CMap for the Symbol font.

The Symbol font uses the Adobe Symbol encoding, which maps
character codes to Greek letters, mathematical symbols, and
other special characters.

## Returns

`string`

A complete CMap program as a string.
