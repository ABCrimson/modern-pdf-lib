[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseIccColorSpace

# Function: parseIccColorSpace()

> **parseIccColorSpace**(`data`): `string`

Defined in: [src/assets/image/iccProfile.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/iccProfile.ts#L84)

Read the color space signature from raw ICC profile data.

The ICC profile header stores a 4-byte color space of data field
at byte offset 16. This function reads and decodes that signature
into a human-readable string.

## Parameters

### data

`Uint8Array`

Raw ICC profile bytes.

## Returns

`string`

The color space name (e.g. `'RGB'`, `'CMYK'`, `'GRAY'`),
         or `'Unknown'` if the data is too short or the signature
         is not recognized.

## Example

```ts
import { parseIccColorSpace } from 'modern-pdf-lib';

const colorSpace = parseIccColorSpace(iccProfileBytes);
console.log(colorSpace); // 'RGB'
```
