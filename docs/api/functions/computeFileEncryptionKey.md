[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeFileEncryptionKey

# Function: computeFileEncryptionKey()

```ts
function computeFileEncryptionKey(
   password, 
   dict, 
fileId): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/crypto/keyDerivation.ts:777](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/keyDerivation.ts#L777)

Compute the file encryption key from a password and encryption dict.

Tries the password as both user and owner password. Returns the key
on the first successful match, or throws if neither works.

Results are cached so that re-opening the same PDF with the same
password skips the expensive key derivation.

## Parameters

### password

`string`

The password to try.

### dict

[`EncryptDictValues`](../interfaces/EncryptDictValues.md)

Encryption dictionary values.

### fileId

`Uint8Array`

The first element of the /ID array (unused for R&gt;=5).

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The file encryption key.

## Throws

If the password is incorrect.
