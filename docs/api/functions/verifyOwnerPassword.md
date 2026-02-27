[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyOwnerPassword

# Function: verifyOwnerPassword()

> **verifyOwnerPassword**(`password`, `dict`, `fileId`): `Promise`\<`boolean`\>

Defined in: [src/crypto/keyDerivation.ts:771](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/keyDerivation.ts#L771)

Verify an owner password against the /O value in the encryption dict.

For R=2-4: Recover the user password from /O using the owner password,
then verify it can produce the correct /U.

## Parameters

### password

`string`

The owner password to verify.

### dict

[`EncryptDictValues`](../interfaces/EncryptDictValues.md)

Encryption dictionary values.

### fileId

`Uint8Array`

The first element of the /ID array.

## Returns

`Promise`\<`boolean`\>

True if the password is the correct owner password.
