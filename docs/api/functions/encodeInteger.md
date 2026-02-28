[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeInteger

# Function: encodeInteger()

> **encodeInteger**(`data`): `Uint8Array`

Defined in: [src/signature/pkcs7.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/signature/pkcs7.ts#L249)

Encode an INTEGER.

DER integers are signed; a leading 0x00 byte is added if the
high bit of the first byte is set (to indicate a positive value).

## Parameters

### data

`Uint8Array`

## Returns

`Uint8Array`
