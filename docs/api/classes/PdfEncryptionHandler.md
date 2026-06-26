[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfEncryptionHandler

# Class: PdfEncryptionHandler

Defined in: [src/crypto/encryptionHandler.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L104)

Handles encryption and decryption of PDF objects according to the
standard security handler.

Create via:
- `PdfEncryptionHandler.create(options)` for new encryption
- `PdfEncryptionHandler.fromEncryptDict(dict, fileId, password)` for existing

## Methods

### buildEncryptDict()

> **buildEncryptDict**(): [`PdfDict`](PdfDict.md)

Defined in: [src/crypto/encryptionHandler.ts:545](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L545)

Build the /Encrypt dictionary for the PDF trailer.

#### Returns

[`PdfDict`](PdfDict.md)

A PdfDict suitable for use as the /Encrypt entry.

***

### decryptObject()

> **decryptObject**(`objNum`, `genNum`, `data`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/crypto/encryptionHandler.ts:483](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L483)

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

Defined in: [src/crypto/encryptionHandler.ts:528](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L528)

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

Defined in: [src/crypto/encryptionHandler.ts:462](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L462)

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

Defined in: [src/crypto/encryptionHandler.ts:509](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L509)

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

Defined in: [src/crypto/encryptionHandler.ts:651](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L651)

The file ID used for key derivation.

#### Returns

`Uint8Array`

***

### getFileKey()

> **getFileKey**(): `Uint8Array`

Defined in: [src/crypto/encryptionHandler.ts:646](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L646)

The file encryption key (for testing/debugging).

#### Returns

`Uint8Array`

***

### getPermissions()

> **getPermissions**(): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

Defined in: [src/crypto/encryptionHandler.ts:621](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L621)

Get the permission flags.

#### Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

***

### getPermissionsValue()

> **getPermissionsValue**(): `number`

Defined in: [src/crypto/encryptionHandler.ts:626](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L626)

Get the raw permissions value.

#### Returns

`number`

***

### getRevision()

> **getRevision**(): `number`

Defined in: [src/crypto/encryptionHandler.ts:641](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L641)

The security handler revision (/R).

#### Returns

`number`

***

### getVersion()

> **getVersion**(): `number`

Defined in: [src/crypto/encryptionHandler.ts:636](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L636)

The algorithm version (/V).

#### Returns

`number`

***

### isAes()

> **isAes**(): `boolean`

Defined in: [src/crypto/encryptionHandler.ts:631](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L631)

Whether this handler uses AES (vs RC4).

#### Returns

`boolean`

***

### isMetadataEncrypted()

> **isMetadataEncrypted**(): `boolean`

Defined in: [src/crypto/encryptionHandler.ts:656](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L656)

Whether metadata streams are encrypted.

#### Returns

`boolean`

***

### create()

> `static` **create**(`options`, `fileId?`): `Promise`\<`PdfEncryptionHandler`\>

Defined in: [src/crypto/encryptionHandler.ts:197](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L197)

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

Defined in: [src/crypto/encryptionHandler.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L312)

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
