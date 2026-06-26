[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readWoffHeader

# Function: readWoffHeader()

> **readWoffHeader**(`data`): [`WoffInfo`](../interfaces/WoffInfo.md)

Defined in: src/assets/font/woff.ts:123

Parse the header of a WOFF1 or WOFF2 file.

## Parameters

### data

`Uint8Array`

The font container bytes.

## Returns

[`WoffInfo`](../interfaces/WoffInfo.md)

A [WoffInfo](../interfaces/WoffInfo.md) describing the container.

## Throws

If the data is too small or carries an unrecognised signature.
