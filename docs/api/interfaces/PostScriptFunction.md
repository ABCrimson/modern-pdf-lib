[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PostScriptFunction

# Interface: PostScriptFunction

Defined in: [src/core/pdfFunctions.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L104)

Type 4 — PostScript calculator function (ISO 32000-2 §7.10.5).

`source` is the PostScript program including its enclosing `{ … }`.

## Properties

### domain

```ts
readonly domain: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L107)

Input domain `[min0 max0 …]`, two entries per input.

***

### functionType

```ts
readonly functionType: 4;
```

Defined in: [src/core/pdfFunctions.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L105)

***

### range

```ts
readonly range: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L109)

Output range `[min0 max0 …]`, two entries per output component.

***

### source

```ts
readonly source: string;
```

Defined in: [src/core/pdfFunctions.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L111)

The PostScript calculator source, including the outer braces.
