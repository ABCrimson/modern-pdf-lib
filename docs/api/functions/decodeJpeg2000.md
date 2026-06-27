[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeJpeg2000

# Function: decodeJpeg2000()

```ts
function decodeJpeg2000(data, params?): Jpeg2000Image;
```

Defined in: [src/parser/jpeg2000Decode.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000Decode.ts#L103)

Decode a JPEG2000 (JP2 or raw J2K codestream) image.

## Parameters

### data

`Uint8Array`

JP2 file bytes or raw J2K codestream bytes.

### params?

`Jpeg2000DecodeParams`

Optional decode parameters.

## Returns

`Jpeg2000Image`

Decoded image with raw pixel data.
