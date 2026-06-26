[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyOwnerPassword

# Function: verifyOwnerPassword()

```ts
function verifyOwnerPassword(
   password, 
   dict, 
fileId): Promise<boolean>;
```

Defined in: [src/crypto/keyDerivation.ts:963](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/keyDerivation.ts#L963)

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

`Promise`\&lt;`boolean`\&gt;

True if the password is the correct owner password.
