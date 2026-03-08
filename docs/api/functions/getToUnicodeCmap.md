[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getToUnicodeCmap

# Function: getToUnicodeCmap()

> **getToUnicodeCmap**(`fontName`): `string`

Defined in: [src/compliance/toUnicodeCmap.ts:606](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/compliance/toUnicodeCmap.ts#L606)

Get the appropriate ToUnicode CMap for a standard 14 font.

- Symbol → Symbol encoding CMap
- ZapfDingbats → ZapfDingbats encoding CMap
- All others → WinAnsi (Windows-1252) encoding CMap

## Parameters

### fontName

`string`

The PDF base font name (e.g. `'Helvetica'`, `'Symbol'`).

## Returns

`string`

A complete CMap program as a string.
