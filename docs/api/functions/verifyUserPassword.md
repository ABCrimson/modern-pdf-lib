[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyUserPassword

# Function: verifyUserPassword()

```ts
function verifyUserPassword(
   password, 
   dict, 
fileId): Promise<boolean>;
```

Defined in: [src/crypto/keyDerivation.ts:910](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/keyDerivation.ts#L910)

Verify a user password against the /U value in the encryption dict.

For R=2: Compare the entire 32 bytes.
For R=3/4: Compare only the first 16 bytes (the rest is arbitrary).

## Parameters

### password

`string`

The password to verify.

### dict

[`EncryptDictValues`](../interfaces/EncryptDictValues.md)

Encryption dictionary values.

### fileId

`Uint8Array`

The first element of the /ID array.

## Returns

`Promise`\&lt;`boolean`\&gt;

True if the password is correct.
