[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptOptions

# Interface: EncryptOptions

Defined in: [src/crypto/encryptionHandler.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/encryptionHandler.ts#L57)

Options for encrypting a PDF document.

## Properties

### algorithm?

```ts
optional algorithm?: EncryptAlgorithm;
```

Defined in: [src/crypto/encryptionHandler.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/encryptionHandler.ts#L65)

Encryption algorithm. Default: `'aes-128'`.

***

### ownerPassword

```ts
ownerPassword: string;
```

Defined in: [src/crypto/encryptionHandler.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/encryptionHandler.ts#L61)

The owner password (restricts editing).

***

### permissions?

```ts
optional permissions?: PdfPermissionFlags;
```

Defined in: [src/crypto/encryptionHandler.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/encryptionHandler.ts#L63)

Permission flags.

***

### userPassword

```ts
userPassword: string;
```

Defined in: [src/crypto/encryptionHandler.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/encryptionHandler.ts#L59)

The user password (may be empty string for open access).
