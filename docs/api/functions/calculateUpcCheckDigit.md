[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateUpcCheckDigit

# Function: calculateUpcCheckDigit()

> **calculateUpcCheckDigit**(`data`): `number`

Defined in: [src/barcode/upc.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/upc.ts#L29)

Calculate the UPC-A check digit (Modulo-10 algorithm).

## Parameters

### data

`string`

11-digit numeric string (without check digit).

## Returns

`number`

The single check digit (0-9).
