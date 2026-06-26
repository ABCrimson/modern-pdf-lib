[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IfdEntry

# Interface: IfdEntry

Defined in: [src/assets/image/tiffDecode.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L45)

A single IFD entry (tag).

## Properties

### count

```ts
readonly count: number;
```

Defined in: [src/assets/image/tiffDecode.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L51)

Number of values.

***

### tag

```ts
readonly tag: number;
```

Defined in: [src/assets/image/tiffDecode.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L47)

Tag ID (e.g., 256 = ImageWidth).

***

### type

```ts
readonly type: number;
```

Defined in: [src/assets/image/tiffDecode.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L49)

Data type (1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, etc.).

***

### values

```ts
readonly values: number[];
```

Defined in: [src/assets/image/tiffDecode.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L53)

The value(s) or offset to value data.
