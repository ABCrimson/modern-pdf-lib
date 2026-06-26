[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ByteWriter

# Interface: ByteWriter

Defined in: [src/core/pdfObjects.ts:21](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L21)

Minimal interface consumed by every `serialize()` method.
Implementations may write to a growing `Uint8Array`, a `WritableStream`,
etc.

## Methods

### write()

```ts
write(data): void;
```

Defined in: [src/core/pdfObjects.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L23)

Append raw bytes.

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`

***

### writeString()

```ts
writeString(str): void;
```

Defined in: [src/core/pdfObjects.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L25)

Append an ASCII / Latin-1 string — callers guarantee all chars &lt; 0x100.

#### Parameters

##### str

`string`

#### Returns

`void`
