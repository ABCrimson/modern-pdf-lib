[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / convertTiffCmykToRgb

# Function: convertTiffCmykToRgb()

> **convertTiffCmykToRgb**(`cmykPixels`, `width`, `height`): `Uint8Array`

Defined in: [src/assets/image/tiffCmyk.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffCmyk.ts#L72)

Convert CMYK pixel data to RGB.

Uses the standard CMYK-to-RGB formula:
```
R = 255 * (1 - C/255) * (1 - K/255)
G = 255 * (1 - M/255) * (1 - K/255)
B = 255 * (1 - Y/255) * (1 - K/255)
```

## Parameters

### cmykPixels

`Uint8Array`

Flat array of CMYK pixel data (4 bytes per pixel: C, M, Y, K).

### width

`number`

Image width in pixels.

### height

`number`

Image height in pixels.

## Returns

`Uint8Array`

Flat array of RGB pixel data (3 bytes per pixel: R, G, B).

## Throws

If the input array length does not match width * height * 4.
