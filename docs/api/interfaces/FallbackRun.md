[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FallbackRun

# Interface: FallbackRun

Defined in: [src/assets/font/fontFallback.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L36)

A contiguous slice of the input text that resolves to a single font.

## Properties

### font

```ts
readonly font: string;
```

Defined in: [src/assets/font/fontFallback.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L38)

Name of the font chosen for every code point in this run.

***

### start

```ts
readonly start: number;
```

Defined in: [src/assets/font/fontFallback.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L42)

Code-point index (not UTF-16 index) where this run starts.

***

### text

```ts
readonly text: string;
```

Defined in: [src/assets/font/fontFallback.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L40)

The text covered by this run (may include astral characters).
