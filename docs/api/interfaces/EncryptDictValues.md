[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptDictValues

# Interface: EncryptDictValues

Defined in: [src/crypto/keyDerivation.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L112)

The subset of encryption dictionary values needed by key derivation.

## Properties

### encryptMetadata

> **encryptMetadata**: `boolean`

Defined in: [src/crypto/keyDerivation.ts:132](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L132)

/EncryptMetadata: whether to encrypt the /Metadata stream.

***

### keyLength

> **keyLength**: `number`

Defined in: [src/crypto/keyDerivation.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L118)

/Length value in bits (40-256, default 40).

***

### ownerEncryptionKey?

> `optional` **ownerEncryptionKey**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/crypto/keyDerivation.ts:126](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L126)

/OE value: owner encryption key (32 bytes, R>=5 only).

***

### ownerKey

> **ownerKey**: `Uint8Array`

Defined in: [src/crypto/keyDerivation.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L120)

/O value: owner key (32 bytes for R<=4, 48 bytes for R>=5).

***

### permissions

> **permissions**: `number`

Defined in: [src/crypto/keyDerivation.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L124)

/P value: permissions integer.

***

### perms?

> `optional` **perms**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/crypto/keyDerivation.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L130)

/Perms value: encrypted permissions (16 bytes, R>=5 only).

***

### revision

> **revision**: `number`

Defined in: [src/crypto/keyDerivation.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L116)

/R value: revision number (2, 3, 4, 5, or 6).

***

### userEncryptionKey?

> `optional` **userEncryptionKey**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/crypto/keyDerivation.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L128)

/UE value: user encryption key (32 bytes, R>=5 only).

***

### userKey

> **userKey**: `Uint8Array`

Defined in: [src/crypto/keyDerivation.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L122)

/U value: user key (32 bytes for R<=4, 48 bytes for R>=5).

***

### version

> **version**: `number`

Defined in: [src/crypto/keyDerivation.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/keyDerivation.ts#L114)

/V value: algorithm version (1, 2, 4, or 5).
