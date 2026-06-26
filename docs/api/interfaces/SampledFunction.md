[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SampledFunction

# Interface: SampledFunction

Defined in: [src/core/pdfFunctions.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L41)

Type 0 — sampled function (ISO 32000-2 §7.10.2).

Samples are stored row-major with the first input dimension varying
fastest, each sample component packed into `bitsPerSample` bits and already
decoded into the `[0, 2^bitsPerSample − 1]` integer range as numbers.

## Properties

### bitsPerSample

```ts
readonly bitsPerSample: number;
```

Defined in: [src/core/pdfFunctions.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L50)

Bits used to represent each sample component (1,2,4,8,12,16,24,32).

***

### decode?

```ts
readonly optional decode?: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L59)

Per-output decode pairs mapping raw samples → range.

***

### domain

```ts
readonly domain: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L44)

Input domain `[min0 max0 min1 max1 …]`, two entries per input.

***

### encode?

```ts
readonly optional encode?: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L57)

Per-input encode pairs mapping domain → sample-grid coordinates.

***

### functionType

```ts
readonly functionType: 0;
```

Defined in: [src/core/pdfFunctions.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L42)

***

### range

```ts
readonly range: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L46)

Output range `[min0 max0 …]`, two entries per output component.

***

### samples

```ts
readonly samples: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L55)

Flat list of sample component values, row-major, first input dimension
varying fastest, output components grouped per grid point.

***

### size

```ts
readonly size: readonly number[];
```

Defined in: [src/core/pdfFunctions.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfFunctions.ts#L48)

Number of samples in each input dimension.
