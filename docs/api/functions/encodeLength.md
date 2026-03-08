[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeLength

# Function: encodeLength()

> **encodeLength**(`length`): `Uint8Array`

Defined in: [src/signature/pkcs7.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/signature/pkcs7.ts#L134)

Encode the length field of a DER TLV (Tag-Length-Value).

- Lengths 0–127 are encoded as a single byte.
- Lengths >= 128 use the long form: first byte has bit 7 set and
  the lower 7 bits give the number of length bytes that follow.

## Parameters

### length

`number`

## Returns

`Uint8Array`
