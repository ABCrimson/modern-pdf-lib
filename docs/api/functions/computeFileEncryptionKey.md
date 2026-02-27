[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeFileEncryptionKey

# Function: computeFileEncryptionKey()

> **computeFileEncryptionKey**(`password`, `dict`, `fileId`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/keyDerivation.ts:600](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/keyDerivation.ts#L600)

Compute the file encryption key from a password and encryption dict.

Tries the password as both user and owner password. Returns the key
on the first successful match, or throws if neither works.

## Parameters

### password

`string`

The password to try.

### dict

[`EncryptDictValues`](../interfaces/EncryptDictValues.md)

Encryption dictionary values.

### fileId

`Uint8Array`

The first element of the /ID array (unused for R>=5).

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The file encryption key.

## Throws

If the password is incorrect.
