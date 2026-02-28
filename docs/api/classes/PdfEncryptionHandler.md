[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfEncryptionHandler

# Class: PdfEncryptionHandler

Defined in: [src/crypto/encryptionHandler.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L108)

Handles encryption and decryption of PDF objects according to the
standard security handler.

Create via:
- `PdfEncryptionHandler.create(options)` for new encryption
- `PdfEncryptionHandler.fromEncryptDict(dict, fileId, password)` for existing

## Methods

### buildEncryptDict()

> **buildEncryptDict**(): [`PdfDict`](PdfDict.md)

Defined in: [src/crypto/encryptionHandler.ts:530](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L530)

Build the /Encrypt dictionary for the PDF trailer.

#### Returns

[`PdfDict`](PdfDict.md)

A PdfDict suitable for use as the /Encrypt entry.

***

### decryptObject()

> **decryptObject**(`objNum`, `genNum`, `data`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/encryptionHandler.ts:468](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L468)

Decrypt raw data for a specific object.

#### Parameters

##### objNum

`number`

Object number.

##### genNum

`number`

Generation number.

##### data

`Uint8Array`

Encrypted data.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Decrypted data.

***

### decryptStream()

> **decryptStream**(`objNum`, `genNum`, `streamData`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/encryptionHandler.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L513)

Decrypt a stream's data.

#### Parameters

##### objNum

`number`

Object number.

##### genNum

`number`

Generation number.

##### streamData

`Uint8Array`

Encrypted stream bytes.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Decrypted stream bytes.

***

### encryptObject()

> **encryptObject**(`objNum`, `genNum`, `data`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/encryptionHandler.ts:447](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L447)

Encrypt raw data for a specific object.

#### Parameters

##### objNum

`number`

Object number.

##### genNum

`number`

Generation number.

##### data

`Uint8Array`

Plaintext data.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Encrypted data.

***

### encryptString()

> **encryptString**(`objNum`, `genNum`, `str`): `Promise`\<[`PdfString`](PdfString.md)\>

Defined in: [src/crypto/encryptionHandler.ts:494](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L494)

Encrypt a PdfString value.

Converts the string value to bytes, encrypts, and returns a new
hex-encoded PdfString.

#### Parameters

##### objNum

`number`

Object number.

##### genNum

`number`

Generation number.

##### str

[`PdfString`](PdfString.md)

The string to encrypt.

#### Returns

`Promise`\<[`PdfString`](PdfString.md)\>

An encrypted PdfString (hex-encoded).

***

### getFileId()

> **getFileId**(): `Uint8Array`

Defined in: [src/crypto/encryptionHandler.ts:636](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L636)

The file ID used for key derivation.

#### Returns

`Uint8Array`

***

### getFileKey()

> **getFileKey**(): `Uint8Array`

Defined in: [src/crypto/encryptionHandler.ts:631](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L631)

The file encryption key (for testing/debugging).

#### Returns

`Uint8Array`

***

### getPermissions()

> **getPermissions**(): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

Defined in: [src/crypto/encryptionHandler.ts:606](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L606)

Get the permission flags.

#### Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

***

### getPermissionsValue()

> **getPermissionsValue**(): `number`

Defined in: [src/crypto/encryptionHandler.ts:611](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L611)

Get the raw permissions value.

#### Returns

`number`

***

### getRevision()

> **getRevision**(): `number`

Defined in: [src/crypto/encryptionHandler.ts:626](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L626)

The security handler revision (/R).

#### Returns

`number`

***

### getVersion()

> **getVersion**(): `number`

Defined in: [src/crypto/encryptionHandler.ts:621](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L621)

The algorithm version (/V).

#### Returns

`number`

***

### isAes()

> **isAes**(): `boolean`

Defined in: [src/crypto/encryptionHandler.ts:616](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L616)

Whether this handler uses AES (vs RC4).

#### Returns

`boolean`

***

### isMetadataEncrypted()

> **isMetadataEncrypted**(): `boolean`

Defined in: [src/crypto/encryptionHandler.ts:641](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L641)

Whether metadata streams are encrypted.

#### Returns

`boolean`

***

### create()

> `static` **create**(`options`, `fileId?`): `Promise`\<`PdfEncryptionHandler`\>

Defined in: [src/crypto/encryptionHandler.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L191)

Create a new encryption handler for encrypting a document.

Generates all necessary keys and values for the /Encrypt dictionary.

#### Parameters

##### options

[`EncryptOptions`](../interfaces/EncryptOptions.md)

Encryption options.

##### fileId?

`Uint8Array`\<`ArrayBufferLike`\>

Optional file ID. If omitted, a random one is generated.

#### Returns

`Promise`\<`PdfEncryptionHandler`\>

A configured PdfEncryptionHandler.

***

### fromEncryptDict()

> `static` **fromEncryptDict**(`dict`, `fileId`, `password`): `Promise`\<`PdfEncryptionHandler`\>

Defined in: [src/crypto/encryptionHandler.ts:306](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/encryptionHandler.ts#L306)

Create an encryption handler from an existing /Encrypt dictionary.

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

The /Encrypt dictionary from the PDF trailer.

##### fileId

`Uint8Array`

The first element of the /ID array.

##### password

`string`

The password to try (user or owner).

#### Returns

`Promise`\<`PdfEncryptionHandler`\>

A configured PdfEncryptionHandler.

#### Throws

If the password is incorrect or the dict is invalid.
