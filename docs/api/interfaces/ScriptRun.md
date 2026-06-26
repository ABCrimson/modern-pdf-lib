[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ScriptRun

# Interface: ScriptRun

Defined in: [src/assets/font/fontFallback.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L48)

A contiguous slice of the input text belonging to a single Unicode script.

## Properties

### script

```ts
readonly script: string;
```

Defined in: [src/assets/font/fontFallback.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L50)

Script name (e.g. `'Latin'`, `'Han'`, `'Common'`).

***

### start

```ts
readonly start: number;
```

Defined in: [src/assets/font/fontFallback.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L54)

Code-point index (not UTF-16 index) where this run starts.

***

### text

```ts
readonly text: string;
```

Defined in: [src/assets/font/fontFallback.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontFallback.ts#L52)

The text covered by this run.
