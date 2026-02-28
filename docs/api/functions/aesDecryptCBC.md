[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / aesDecryptCBC

# Function: aesDecryptCBC()

> **aesDecryptCBC**(`key`, `data`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/aes.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/crypto/aes.ts#L133)

Decrypt data using AES-CBC with PKCS#7 padding.

Expects the first 16 bytes to be the IV, followed by the ciphertext.

## Parameters

### key

`Uint8Array`

AES key: 16 bytes (AES-128) or 32 bytes (AES-256).

### data

`Uint8Array`

IV (16 bytes) + ciphertext.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The decrypted plaintext.
