[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeLength

# Function: encodeLength()

```ts
function encodeLength(length): Uint8Array;
```

Defined in: [src/signature/pkcs7.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/pkcs7.ts#L134)

Encode the length field of a DER TLV (Tag-Length-Value).

- Lengths 0–127 are encoded as a single byte.
- Lengths &gt;= 128 use the long form: first byte has bit 7 set and
  the lower 7 bits give the number of length bytes that follow.

## Parameters

### length

`number`

## Returns

`Uint8Array`
