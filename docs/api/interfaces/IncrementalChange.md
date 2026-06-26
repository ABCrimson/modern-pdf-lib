[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalChange

# Interface: IncrementalChange

Defined in: [src/signature/incrementalOptimizer.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalOptimizer.ts#L22)

A single object change for an incremental update.

## Properties

### generationNumber

```ts
generationNumber: number;
```

Defined in: [src/signature/incrementalOptimizer.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalOptimizer.ts#L26)

The generation number.

***

### newContent

```ts
newContent: Uint8Array;
```

Defined in: [src/signature/incrementalOptimizer.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalOptimizer.ts#L28)

The new content for this object (raw bytes).

***

### objectNumber

```ts
objectNumber: number;
```

Defined in: [src/signature/incrementalOptimizer.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalOptimizer.ts#L24)

The PDF object number.
