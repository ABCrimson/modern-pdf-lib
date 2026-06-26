[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StitchingFunction

# Interface: StitchingFunction

Defined in: [src/core/pdfFunctions.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L87)

Type 3 — stitching function (ISO 32000-2 §7.10.4).

A 1-input function whose domain is split into `k` subdomains by `bounds`;
each subdomain dispatches to one of `functions`, after re-encoding the
input into that sub-function's domain via `encode`.

## Properties

### bounds

```ts
readonly bounds: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L94)

The `k − 1` interior boundary values, strictly increasing.

***

### domain

```ts
readonly domain: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L90)

Input domain `[min max]`.

***

### encode

```ts
readonly encode: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L96)

`2k` encode values mapping each subdomain to its sub-function domain.

***

### functions

```ts
readonly functions: readonly PdfFunctionDef[];
```

Defined in: [src/core/pdfFunctions.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L92)

The `k` sub-functions.

***

### functionType

```ts
readonly functionType: 3;
```

Defined in: [src/core/pdfFunctions.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L88)
