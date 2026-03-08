[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / recompressWebP

# Function: recompressWebP()

> **recompressWebP**(`pixels`, `width`, `height`, `quality?`): `Uint8Array`

Defined in: [src/assets/image/webpOptimize.ts:722](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpOptimize.ts#L722)

Re-encode decoded WebP pixels as JPEG data for PDF embedding.

WebP cannot be embedded directly in PDF files. This function takes
decoded pixel data (from a WebP decoder) and produces JPEG bytes
suitable for PDF embedding with /DCTDecode filter.

## Parameters

### pixels

`Uint8Array`

Decoded pixel data (RGB or RGBA, row-major).

### width

`number`

Image width in pixels.

### height

`number`

Image height in pixels.

### quality?

`number`

JPEG quality (1-100). Default: 85.

## Returns

`Uint8Array`

JPEG-encoded bytes.
