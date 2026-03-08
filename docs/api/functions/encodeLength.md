[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeLength

# Function: encodeLength()

> **encodeLength**(`length`): `Uint8Array`

Defined in: [src/signature/pkcs7.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/pkcs7.ts#L134)

Encode the length field of a DER TLV (Tag-Length-Value).

- Lengths 0–127 are encoded as a single byte.
- Lengths >= 128 use the long form: first byte has bit 7 set and
  the lower 7 bits give the number of length bytes that follow.

## Parameters

### length

`number`

## Returns

`Uint8Array`
