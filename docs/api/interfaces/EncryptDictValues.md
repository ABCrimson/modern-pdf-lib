[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptDictValues

# Interface: EncryptDictValues

Defined in: [src/crypto/keyDerivation.ts:253](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L253)

The subset of encryption dictionary values needed by key derivation.

## Properties

### encryptMetadata

> **encryptMetadata**: `boolean`

Defined in: [src/crypto/keyDerivation.ts:273](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L273)

/EncryptMetadata: whether to encrypt the /Metadata stream.

***

### keyLength

> **keyLength**: `number`

Defined in: [src/crypto/keyDerivation.ts:259](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L259)

/Length value in bits (40-256, default 40).

***

### ownerEncryptionKey?

> `optional` **ownerEncryptionKey**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/crypto/keyDerivation.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L267)

/OE value: owner encryption key (32 bytes, R>=5 only).

***

### ownerKey

> **ownerKey**: `Uint8Array`

Defined in: [src/crypto/keyDerivation.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L261)

/O value: owner key (32 bytes for R<=4, 48 bytes for R>=5).

***

### permissions

> **permissions**: `number`

Defined in: [src/crypto/keyDerivation.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L265)

/P value: permissions integer.

***

### perms?

> `optional` **perms**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/crypto/keyDerivation.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L271)

/Perms value: encrypted permissions (16 bytes, R>=5 only).

***

### revision

> **revision**: `number`

Defined in: [src/crypto/keyDerivation.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L257)

/R value: revision number (2, 3, 4, 5, or 6).

***

### userEncryptionKey?

> `optional` **userEncryptionKey**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/crypto/keyDerivation.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L269)

/UE value: user encryption key (32 bytes, R>=5 only).

***

### userKey

> **userKey**: `Uint8Array`

Defined in: [src/crypto/keyDerivation.ts:263](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L263)

/U value: user key (32 bytes for R<=4, 48 bytes for R>=5).

***

### version

> **version**: `number`

Defined in: [src/crypto/keyDerivation.ts:255](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/crypto/keyDerivation.ts#L255)

/V value: algorithm version (1, 2, 4, or 5).
