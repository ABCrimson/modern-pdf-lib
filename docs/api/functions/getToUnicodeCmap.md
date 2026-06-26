[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getToUnicodeCmap

# Function: getToUnicodeCmap()

```ts
function getToUnicodeCmap(fontName): string;
```

Defined in: [src/compliance/toUnicodeCmap.ts:606](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/toUnicodeCmap.ts#L606)

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
