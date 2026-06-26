[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateZapfDingbatsToUnicodeCmap

# Function: generateZapfDingbatsToUnicodeCmap()

```ts
function generateZapfDingbatsToUnicodeCmap(): string;
```

Defined in: [src/compliance/toUnicodeCmap.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/toUnicodeCmap.ts#L592)

Generate a ToUnicode CMap for the ZapfDingbats font.

The ZapfDingbats font uses its own built-in encoding that maps
character codes to decorative symbols, arrows, and ornaments.

## Returns

`string`

A complete CMap program as a string.
