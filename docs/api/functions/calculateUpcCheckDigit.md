[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / calculateUpcCheckDigit

# Function: calculateUpcCheckDigit()

```ts
function calculateUpcCheckDigit(data): number;
```

Defined in: [src/barcode/upc.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/upc.ts#L29)

Calculate the UPC-A check digit (Modulo-10 algorithm).

## Parameters

### data

`string`

11-digit numeric string (without check digit).

## Returns

`number`

The single check digit (0-9).
