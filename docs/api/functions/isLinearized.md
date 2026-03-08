[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isLinearized

# Function: isLinearized()

> **isLinearized**(`pdfBytes`): `boolean`

Defined in: [src/core/linearization.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L82)

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
