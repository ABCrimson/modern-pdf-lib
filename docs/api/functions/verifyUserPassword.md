[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyUserPassword

# Function: verifyUserPassword()

> **verifyUserPassword**(`password`, `dict`, `fileId`): `Promise`\<`boolean`\>

Defined in: [src/crypto/keyDerivation.ts:907](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/crypto/keyDerivation.ts#L907)

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

`Promise`\<`boolean`\>

True if the password is correct.
