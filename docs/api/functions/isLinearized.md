[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isLinearized

# Function: isLinearized()

```ts
function isLinearized(pdfBytes): boolean;
```

Defined in: [src/core/linearization.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L86)

Check if a PDF is linearized.

A linearized PDF has a linearization parameter dictionary as the
very first indirect object after the header.  This dictionary
contains `/Linearized` as a key.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

`boolean`

`true` if the PDF appears to be linearized.
