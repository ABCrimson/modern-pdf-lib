[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / base64Decode

# Function: base64Decode()

> **base64Decode**(`str`): `Uint8Array`

Defined in: [src/utils/base64.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/utils/base64.ts#L33)

Decode a standard Base64 string to a `Uint8Array`.

Whitespace characters (spaces, tabs, newlines) are stripped before
decoding. Trailing `=` padding is handled correctly.

## Parameters

### str

`string`

A Base64-encoded string.

## Returns

`Uint8Array`

The decoded bytes.

## Throws

If the string contains invalid Base64 characters.
