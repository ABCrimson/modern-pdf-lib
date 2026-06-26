[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OverflowResult

# Interface: OverflowResult

Defined in: [src/layout/overflow.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/overflow.ts#L24)

Result of applying an overflow mode to a text string.

## Properties

### fontSize

```ts
readonly fontSize: number;
```

Defined in: [src/layout/overflow.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/overflow.ts#L28)

The font size to use (may differ from input for 'shrink' mode).

***

### lines

```ts
readonly lines: readonly string[];
```

Defined in: [src/layout/overflow.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/overflow.ts#L26)

The processed line(s) of text.

***

### wasModified

```ts
readonly wasModified: boolean;
```

Defined in: [src/layout/overflow.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/overflow.ts#L30)

Whether the text was modified (truncated, wrapped, or shrunk).
