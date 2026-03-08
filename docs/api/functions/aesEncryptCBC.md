[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / aesEncryptCBC

# Function: aesEncryptCBC()

> **aesEncryptCBC**(`key`, `data`, `iv?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/aes.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/crypto/aes.ts#L97)

Encrypt data using AES-CBC with PKCS#7 padding.

The returned ciphertext has the 16-byte IV prepended:
`[IV (16 bytes)] [ciphertext (N bytes)]`

Web Crypto's AES-CBC implementation automatically applies PKCS#7
padding during encryption and removes it during decryption.

## Parameters

### key

`Uint8Array`

AES key: 16 bytes (AES-128) or 32 bytes (AES-256).

### data

`Uint8Array`

Plaintext data to encrypt.

### iv?

`Uint8Array`\<`ArrayBufferLike`\>

Optional 16-byte initialization vector.  If omitted, a
             random IV is generated.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

IV + ciphertext as a single Uint8Array.
