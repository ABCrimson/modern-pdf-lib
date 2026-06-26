[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalObject

# Interface: IncrementalObject

Defined in: [src/signature/incrementalSave.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L59)

An object to be appended in an incremental update.

## Properties

### data

```ts
data: Uint8Array;
```

Defined in: [src/signature/incrementalSave.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L65)

The serialized object data (everything between `N G obj\n` and `\nendobj`).

***

### generationNumber

```ts
generationNumber: number;
```

Defined in: [src/signature/incrementalSave.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L63)

The generation number (usually 0).

***

### objectNumber

```ts
objectNumber: number;
```

Defined in: [src/signature/incrementalSave.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L61)

The PDF object number.
