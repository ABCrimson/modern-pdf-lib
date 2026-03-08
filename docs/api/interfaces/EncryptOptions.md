[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptOptions

# Interface: EncryptOptions

Defined in: [src/crypto/encryptionHandler.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/crypto/encryptionHandler.ts#L61)

Options for encrypting a PDF document.

## Properties

### algorithm?

> `optional` **algorithm**: [`EncryptAlgorithm`](../type-aliases/EncryptAlgorithm.md)

Defined in: [src/crypto/encryptionHandler.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/crypto/encryptionHandler.ts#L69)

Encryption algorithm. Default: `'aes-128'`.

***

### ownerPassword

> **ownerPassword**: `string`

Defined in: [src/crypto/encryptionHandler.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/crypto/encryptionHandler.ts#L65)

The owner password (restricts editing).

***

### permissions?

> `optional` **permissions**: [`PdfPermissionFlags`](PdfPermissionFlags.md)

Defined in: [src/crypto/encryptionHandler.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/crypto/encryptionHandler.ts#L67)

Permission flags.

***

### userPassword

> **userPassword**: `string`

Defined in: [src/crypto/encryptionHandler.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/crypto/encryptionHandler.ts#L63)

The user password (may be empty string for open access).
