[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findSignatures

# Function: findSignatures()

```ts
function findSignatures(pdfBytes): object[];
```

Defined in: [src/signature/byteRange.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L592)

Find all signature fields in a PDF and extract their ByteRange
and Contents information.

## Parameters

### pdfBytes

`Uint8Array`

The PDF bytes to scan.

## Returns

`object`[]

Array of signature info objects.
