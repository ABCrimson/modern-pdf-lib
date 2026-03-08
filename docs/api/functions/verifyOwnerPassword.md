[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyOwnerPassword

# Function: verifyOwnerPassword()

> **verifyOwnerPassword**(`password`, `dict`, `fileId`): `Promise`\<`boolean`\>

Defined in: [src/crypto/keyDerivation.ts:960](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/crypto/keyDerivation.ts#L960)

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
