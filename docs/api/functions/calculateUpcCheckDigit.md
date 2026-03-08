[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateUpcCheckDigit

# Function: calculateUpcCheckDigit()

> **calculateUpcCheckDigit**(`data`): `number`

Defined in: [src/barcode/upc.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/upc.ts#L29)

Calculate the UPC-A check digit (Modulo-10 algorithm).

## Parameters

### data

`string`

11-digit numeric string (without check digit).

## Returns

`number`

The single check digit (0-9).
