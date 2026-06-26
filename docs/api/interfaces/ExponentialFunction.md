[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExponentialFunction

# Interface: ExponentialFunction

Defined in: [src/core/pdfFunctions.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L68)

Type 2 — exponential interpolation function (ISO 32000-2 §7.10.3).

Defines `out[i] = C0[i] + x^N · (C1[i] − C0[i])` for a single clamped
input `x`.

## Properties

### c0?

```ts
readonly optional c0?: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L73)

Output values at `x = 0`; defaults to `[0]`.

***

### c1?

```ts
readonly optional c1?: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L75)

Output values at `x = 1`; defaults to `[1]`.

***

### domain

```ts
readonly domain: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L71)

Input domain `[min max]` for the single input.

***

### functionType

```ts
readonly functionType: 2;
```

Defined in: [src/core/pdfFunctions.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L69)

***

### n

```ts
readonly n: number;
```

Defined in: [src/core/pdfFunctions.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L77)

Interpolation exponent `N`.
