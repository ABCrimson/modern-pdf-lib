[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeCode39CheckDigit

# Function: computeCode39CheckDigit()

```ts
function computeCode39CheckDigit(data): string;
```

Defined in: [src/barcode/code39.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code39.ts#L158)

Compute the modulo-43 check digit for a Code 39 data string.

## Parameters

### data

`string`

Uppercase data string (without start/stop `*`).

## Returns

`string`

The check digit character.

## Throws

If the data contains characters not in the Code 39 set.
