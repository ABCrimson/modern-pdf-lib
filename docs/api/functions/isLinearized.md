[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isLinearized

# Function: isLinearized()

> **isLinearized**(`pdfBytes`): `boolean`

Defined in: [src/core/linearization.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/linearization.ts#L58)

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
