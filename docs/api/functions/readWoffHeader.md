[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readWoffHeader

# Function: readWoffHeader()

```ts
function readWoffHeader(data): WoffInfo;
```

Defined in: [src/assets/font/woff.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/woff.ts#L123)

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
