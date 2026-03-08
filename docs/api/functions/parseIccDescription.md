[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseIccDescription

# Function: parseIccDescription()

> **parseIccDescription**(`data`): `string` \| `undefined`

Defined in: [src/assets/image/iccProfile.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/iccProfile.ts#L108)

Parse the human-readable description from an ICC profile's 'desc' tag.

Searches the ICC tag table for a tag with signature `'desc'`
(0x64657363) and reads the ASCII description string from it.

The 'desc' tag (ICC v2) has the structure:
- Bytes 0–3: type signature ('desc')
- Bytes 4–7: reserved (0)
- Bytes 8–11: ASCII description length (uint32 BE)
- Bytes 12+: ASCII description string

## Parameters

### data

`Uint8Array`

Raw ICC profile bytes.

## Returns

`string` \| `undefined`

The description string, or `undefined` if the tag is not
         found or cannot be parsed.
