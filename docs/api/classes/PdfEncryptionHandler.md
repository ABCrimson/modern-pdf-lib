[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfEncryptionHandler

# Class: PdfEncryptionHandler

Defined in: [src/crypto/encryptionHandler.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L104)

Handles encryption and decryption of PDF objects according to the
standard security handler.

Create via:
- `PdfEncryptionHandler.create(options)` for new encryption
- `PdfEncryptionHandler.fromEncryptDict(dict, fileId, password)` for existing

## Methods

### buildEncryptDict()

```ts
buildEncryptDict(): PdfDict;
```

Defined in: [src/crypto/encryptionHandler.ts:545](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L545)

Build the /Encrypt dictionary for the PDF trailer.

#### Returns

[`PdfDict`](PdfDict.md)

A PdfDict suitable for use as the /Encrypt entry.

***

### decryptObject()

```ts
decryptObject(
   objNum, 
   genNum, 
data): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/crypto/encryptionHandler.ts:483](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L483)

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

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

Decrypted data.

***

### decryptStream()

```ts
decryptStream(
   objNum, 
   genNum, 
streamData): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/crypto/encryptionHandler.ts:528](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L528)

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

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

Decrypted stream bytes.

***

### encryptObject()

```ts
encryptObject(
   objNum, 
   genNum, 
data): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/crypto/encryptionHandler.ts:462](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L462)

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

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

Encrypted data.

***

### encryptString()

```ts
encryptString(
   objNum, 
   genNum, 
str): Promise<PdfString>;
```

Defined in: [src/crypto/encryptionHandler.ts:509](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L509)

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

`Promise`\&lt;[`PdfString`](PdfString.md)\&gt;

An encrypted PdfString (hex-encoded).

***

### getFileId()

```ts
getFileId(): Uint8Array;
```

Defined in: [src/crypto/encryptionHandler.ts:651](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L651)

The file ID used for key derivation.

#### Returns

`Uint8Array`

***

### getFileKey()

```ts
getFileKey(): Uint8Array;
```

Defined in: [src/crypto/encryptionHandler.ts:646](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L646)

The file encryption key (for testing/debugging).

#### Returns

`Uint8Array`

***

### getPermissions()

```ts
getPermissions(): PdfPermissionFlags;
```

Defined in: [src/crypto/encryptionHandler.ts:621](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L621)

Get the permission flags.

#### Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

***

### getPermissionsValue()

```ts
getPermissionsValue(): number;
```

Defined in: [src/crypto/encryptionHandler.ts:626](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L626)

Get the raw permissions value.

#### Returns

`number`

***

### getRevision()

```ts
getRevision(): number;
```

Defined in: [src/crypto/encryptionHandler.ts:641](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L641)

The security handler revision (/R).

#### Returns

`number`

***

### getVersion()

```ts
getVersion(): number;
```

Defined in: [src/crypto/encryptionHandler.ts:636](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L636)

The algorithm version (/V).

#### Returns

`number`

***

### isAes()

```ts
isAes(): boolean;
```

Defined in: [src/crypto/encryptionHandler.ts:631](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L631)

Whether this handler uses AES (vs RC4).

#### Returns

`boolean`

***

### isMetadataEncrypted()

```ts
isMetadataEncrypted(): boolean;
```

Defined in: [src/crypto/encryptionHandler.ts:656](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L656)

Whether metadata streams are encrypted.

#### Returns

`boolean`

***

### create()

```ts
static create(options, fileId?): Promise<PdfEncryptionHandler>;
```

Defined in: [src/crypto/encryptionHandler.ts:197](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L197)

Create a new encryption handler for encrypting a document.

Generates all necessary keys and values for the /Encrypt dictionary.

#### Parameters

##### options

[`EncryptOptions`](../interfaces/EncryptOptions.md)

Encryption options.

##### fileId?

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Optional file ID. If omitted, a random one is generated.

#### Returns

`Promise`\&lt;`PdfEncryptionHandler`\&gt;

A configured PdfEncryptionHandler.

***

### fromEncryptDict()

```ts
static fromEncryptDict(
   dict, 
   fileId, 
password): Promise<PdfEncryptionHandler>;
```

Defined in: [src/crypto/encryptionHandler.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L312)

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

`Promise`\&lt;`PdfEncryptionHandler`\&gt;

A configured PdfEncryptionHandler.

#### Throws

If the password is incorrect or the dict is invalid.
