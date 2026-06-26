[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateSymbolToUnicodeCmap

# Function: generateSymbolToUnicodeCmap()

```ts
function generateSymbolToUnicodeCmap(): string;
```

Defined in: [src/compliance/toUnicodeCmap.ts:580](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/toUnicodeCmap.ts#L580)

Generate a ToUnicode CMap for the Symbol font.

The Symbol font uses the Adobe Symbol encoding, which maps
character codes to Greek letters, mathematical symbols, and
other special characters.

## Returns

`string`

A complete CMap program as a string.
