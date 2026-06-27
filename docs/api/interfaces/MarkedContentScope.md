[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MarkedContentScope

# Interface: MarkedContentScope

Defined in: [src/accessibility/markedContent.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/markedContent.ts#L31)

Represents a marked-content scope — provides the operator strings
needed to open and close the scope in a content stream.

## Properties

### mcid

```ts
readonly mcid: number;
```

Defined in: [src/accessibility/markedContent.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/markedContent.ts#L33)

The marked-content ID linking to the structure tree.

***

### tag

```ts
readonly tag: string;
```

Defined in: [src/accessibility/markedContent.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/markedContent.ts#L35)

The structure type tag.

## Methods

### begin()

```ts
begin(): string;
```

Defined in: [src/accessibility/markedContent.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/markedContent.ts#L41)

Return the PDF operator string that begins this marked-content
sequence.  For tagged content with an MCID, this produces a
`BDC` (begin marked-content with properties) operator.

#### Returns

`string`

***

### end()

```ts
end(): string;
```

Defined in: [src/accessibility/markedContent.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/markedContent.ts#L46)

Return the PDF operator string that ends this marked-content
sequence (`EMC`).

#### Returns

`string`
