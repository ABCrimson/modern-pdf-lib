[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptDictValues

# Interface: EncryptDictValues

Defined in: [src/crypto/keyDerivation.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L256)

The subset of encryption dictionary values needed by key derivation.

## Properties

### encryptMetadata

```ts
encryptMetadata: boolean;
```

Defined in: [src/crypto/keyDerivation.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L276)

/EncryptMetadata: whether to encrypt the /Metadata stream.

***

### keyLength

```ts
keyLength: number;
```

Defined in: [src/crypto/keyDerivation.ts:262](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L262)

/Length value in bits (40-256, default 40).

***

### ownerEncryptionKey?

```ts
optional ownerEncryptionKey?: Uint8Array<ArrayBufferLike>;
```

Defined in: [src/crypto/keyDerivation.ts:270](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L270)

/OE value: owner encryption key (32 bytes, R&gt;=5 only).

***

### ownerKey

```ts
ownerKey: Uint8Array;
```

Defined in: [src/crypto/keyDerivation.ts:264](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L264)

/O value: owner key (32 bytes for R&lt;=4, 48 bytes for R&gt;=5).

***

### permissions

```ts
permissions: number;
```

Defined in: [src/crypto/keyDerivation.ts:268](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L268)

/P value: permissions integer.

***

### perms?

```ts
optional perms?: Uint8Array<ArrayBufferLike>;
```

Defined in: [src/crypto/keyDerivation.ts:274](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L274)

/Perms value: encrypted permissions (16 bytes, R&gt;=5 only).

***

### revision

```ts
revision: number;
```

Defined in: [src/crypto/keyDerivation.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L260)

/R value: revision number (2, 3, 4, 5, or 6).

***

### userEncryptionKey?

```ts
optional userEncryptionKey?: Uint8Array<ArrayBufferLike>;
```

Defined in: [src/crypto/keyDerivation.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L272)

/UE value: user encryption key (32 bytes, R&gt;=5 only).

***

### userKey

```ts
userKey: Uint8Array;
```

Defined in: [src/crypto/keyDerivation.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L266)

/U value: user key (32 bytes for R&lt;=4, 48 bytes for R&gt;=5).

***

### version

```ts
version: number;
```

Defined in: [src/crypto/keyDerivation.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/keyDerivation.ts#L258)

/V value: algorithm version (1, 2, 4, or 5).
