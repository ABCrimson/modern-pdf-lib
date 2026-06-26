[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextLine

# Interface: TextLine

Defined in: [src/parser/textReconstruct.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L30)

A single reconstructed line of text.

## Properties

### items

```ts
readonly items: readonly TextItem[];
```

Defined in: [src/parser/textReconstruct.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L36)

The source items that make up this line, sorted left-to-right.

***

### text

```ts
readonly text: string;
```

Defined in: [src/parser/textReconstruct.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L32)

The joined text content of the line, in reading order.

***

### y

```ts
readonly y: number;
```

Defined in: [src/parser/textReconstruct.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L34)

The representative baseline `y` coordinate of the line.
