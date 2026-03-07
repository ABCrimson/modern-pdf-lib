[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateUpcCheckDigit

# Function: calculateUpcCheckDigit()

> **calculateUpcCheckDigit**(`data`): `number`

Defined in: [src/barcode/upc.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/upc.ts#L29)

Calculate the UPC-A check digit (Modulo-10 algorithm).

## Parameters

### data

`string`

11-digit numeric string (without check digit).

## Returns

`number`

The single check digit (0-9).
