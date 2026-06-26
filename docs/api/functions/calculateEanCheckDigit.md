[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateEanCheckDigit

# Function: calculateEanCheckDigit()

```ts
function calculateEanCheckDigit(data): number;
```

Defined in: [src/barcode/ean.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/ean.ts#L113)

Calculate the EAN / UPC check digit using the Modulo-10 algorithm.

Works for both EAN-13 (pass 12 digits) and EAN-8 (pass 7 digits).
The algorithm weights digits alternately by 1 and 3 starting from
the rightmost position.

## Parameters

### data

`string`

Numeric string of 7 or 12 digits (without check digit).

## Returns

`number`

The single check digit (0-9).
