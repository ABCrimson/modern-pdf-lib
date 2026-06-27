[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateWinAnsiToUnicodeCmap

# Function: generateWinAnsiToUnicodeCmap()

```ts
function generateWinAnsiToUnicodeCmap(): string;
```

Defined in: [src/compliance/toUnicodeCmap.ts:557](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/toUnicodeCmap.ts#L557)

Generate a ToUnicode CMap string for a standard WinAnsi-encoded font.

WinAnsi (Windows-1252) is the default encoding for the 12 Latin
standard 14 fonts (all except Symbol and ZapfDingbats).
This maps each byte code (32–255) to its Unicode equivalent.

## Returns

`string`

A complete CMap program as a string.
