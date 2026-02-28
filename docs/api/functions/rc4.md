[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / rc4

# Function: rc4()

> **rc4**(`key`, `data`): `Uint8Array`

Defined in: [src/crypto/rc4.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/crypto/rc4.ts#L29)

Encrypt or decrypt data using the RC4 stream cipher.

RC4 is symmetric: `rc4(key, rc4(key, data))` returns the original data.

## Parameters

### key

`Uint8Array`

The encryption key (1-256 bytes).

### data

`Uint8Array`

The data to encrypt or decrypt.

## Returns

`Uint8Array`

The transformed data (same length as input).
