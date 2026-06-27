[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptOptions

# Interface: EncryptOptions

Defined in: [src/crypto/encryptionHandler.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L57)

Options for encrypting a PDF document.

## Properties

### algorithm?

```ts
optional algorithm?: EncryptAlgorithm;
```

Defined in: [src/crypto/encryptionHandler.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L65)

Encryption algorithm. Default: `'aes-128'`.

***

### ownerPassword

```ts
ownerPassword: string;
```

Defined in: [src/crypto/encryptionHandler.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L61)

The owner password (restricts editing).

***

### permissions?

```ts
optional permissions?: PdfPermissionFlags;
```

Defined in: [src/crypto/encryptionHandler.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L63)

Permission flags.

***

### userPassword

```ts
userPassword: string;
```

Defined in: [src/crypto/encryptionHandler.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/encryptionHandler.ts#L59)

The user password (may be empty string for open access).
