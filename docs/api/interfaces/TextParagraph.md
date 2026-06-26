[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextParagraph

# Interface: TextParagraph

Defined in: [src/parser/textReconstruct.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L42)

A reconstructed paragraph: a run of vertically-adjacent lines.

## Properties

### lines

```ts
readonly lines: readonly TextLine[];
```

Defined in: [src/parser/textReconstruct.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L46)

The lines that make up this paragraph, in top-to-bottom reading order.

***

### text

```ts
readonly text: string;
```

Defined in: [src/parser/textReconstruct.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/textReconstruct.ts#L44)

The joined text content of the paragraph (lines joined with `"\n"`).
