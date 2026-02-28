[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeInteger

# Function: encodeInteger()

> **encodeInteger**(`data`): `Uint8Array`

Defined in: [src/signature/pkcs7.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/pkcs7.ts#L249)

Encode an INTEGER.

DER integers are signed; a leading 0x00 byte is added if the
high bit of the first byte is set (to indicate a positive value).

## Parameters

### data

`Uint8Array`

## Returns

`Uint8Array`
