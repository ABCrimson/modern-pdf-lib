[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptOptions

# Interface: EncryptOptions

Defined in: [src/crypto/encryptionHandler.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L57)

Options for encrypting a PDF document.

## Properties

### algorithm?

> `optional` **algorithm?**: [`EncryptAlgorithm`](../type-aliases/EncryptAlgorithm.md)

Defined in: [src/crypto/encryptionHandler.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L65)

Encryption algorithm. Default: `'aes-128'`.

***

### ownerPassword

> **ownerPassword**: `string`

Defined in: [src/crypto/encryptionHandler.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L61)

The owner password (restricts editing).

***

### permissions?

> `optional` **permissions?**: [`PdfPermissionFlags`](PdfPermissionFlags.md)

Defined in: [src/crypto/encryptionHandler.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L63)

Permission flags.

***

### userPassword

> **userPassword**: `string`

Defined in: [src/crypto/encryptionHandler.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/crypto/encryptionHandler.ts#L59)

The user password (may be empty string for open access).
