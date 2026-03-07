[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateWinAnsiToUnicodeCmap

# Function: generateWinAnsiToUnicodeCmap()

> **generateWinAnsiToUnicodeCmap**(): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:557](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/compliance/toUnicodeCmap.ts#L557)

Generate a ToUnicode CMap string for a standard WinAnsi-encoded font.

WinAnsi (Windows-1252) is the default encoding for the 12 Latin
standard 14 fonts (all except Symbol and ZapfDingbats).
This maps each byte code (32–255) to its Unicode equivalent.

## Returns

`string`

A complete CMap program as a string.
