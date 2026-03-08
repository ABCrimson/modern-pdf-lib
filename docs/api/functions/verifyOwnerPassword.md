[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyOwnerPassword

# Function: verifyOwnerPassword()

> **verifyOwnerPassword**(`password`, `dict`, `fileId`): `Promise`\<`boolean`\>

Defined in: [src/crypto/keyDerivation.ts:960](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/crypto/keyDerivation.ts#L960)

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
