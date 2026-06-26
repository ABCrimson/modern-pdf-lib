[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / hasLtvData

# Function: hasLtvData()

```ts
function hasLtvData(pdf): boolean;
```

Defined in: [src/signature/ltvEmbed.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/ltvEmbed.ts#L170)

Check whether a PDF already contains a Document Security Store (DSS).

## Parameters

### pdf

`Uint8Array`

The PDF bytes.

## Returns

`boolean`

`true` if the PDF contains a /DSS dictionary.
