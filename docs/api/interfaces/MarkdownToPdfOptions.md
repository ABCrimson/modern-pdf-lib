[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MarkdownToPdfOptions

# Interface: MarkdownToPdfOptions

Defined in: [src/assets/markdown/markdownToPdf.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/markdown/markdownToPdf.ts#L41)

Options controlling [markdownToPdf](../functions/markdownToPdf.md) layout.

## Properties

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/assets/markdown/markdownToPdf.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/markdown/markdownToPdf.ts#L43)

Base body font size in points.  Defaults to `12`.

***

### lineHeight?

```ts
readonly optional lineHeight?: number;
```

Defined in: [src/assets/markdown/markdownToPdf.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/markdown/markdownToPdf.ts#L50)

Line-height multiplier applied to the font size of each rendered line.
Defaults to `1.4`.

***

### margin?

```ts
readonly optional margin?: number;
```

Defined in: [src/assets/markdown/markdownToPdf.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/markdown/markdownToPdf.ts#L45)

Page margin in points applied to all four sides.  Defaults to `50`.
