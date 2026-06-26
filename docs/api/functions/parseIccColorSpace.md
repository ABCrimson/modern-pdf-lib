[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseIccColorSpace

# Function: parseIccColorSpace()

```ts
function parseIccColorSpace(data): string;
```

Defined in: [src/assets/image/iccProfile.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/iccProfile.ts#L84)

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
