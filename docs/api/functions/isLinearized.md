[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isLinearized

# Function: isLinearized()

> **isLinearized**(`pdfBytes`): `boolean`

Defined in: [src/core/linearization.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/linearization.ts#L58)

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
