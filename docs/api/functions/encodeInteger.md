[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeInteger

# Function: encodeInteger()

> **encodeInteger**(`data`): `Uint8Array`

Defined in: [src/signature/pkcs7.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/pkcs7.ts#L249)

Encode an INTEGER.

DER integers are signed; a leading 0x00 byte is added if the
high bit of the first byte is set (to indicate a positive value).

## Parameters

### data

`Uint8Array`

## Returns

`Uint8Array`
