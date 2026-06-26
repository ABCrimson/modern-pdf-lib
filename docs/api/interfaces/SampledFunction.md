[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SampledFunction

# Interface: SampledFunction

Defined in: src/core/pdfFunctions.ts:41

Type 0 — sampled function (ISO 32000-2 §7.10.2).

Samples are stored row-major with the first input dimension varying
fastest, each sample component packed into `bitsPerSample` bits and already
decoded into the `[0, 2^bitsPerSample − 1]` integer range as numbers.

## Properties

### bitsPerSample

> `readonly` **bitsPerSample**: `number`

Defined in: src/core/pdfFunctions.ts:50

Bits used to represent each sample component (1,2,4,8,12,16,24,32).

***

### decode?

> `readonly` `optional` **decode?**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:59

Per-output decode pairs mapping raw samples → range.

***

### domain

> `readonly` **domain**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:44

Input domain `[min0 max0 min1 max1 …]`, two entries per input.

***

### encode?

> `readonly` `optional` **encode?**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:57

Per-input encode pairs mapping domain → sample-grid coordinates.

***

### functionType

> `readonly` **functionType**: `0`

Defined in: src/core/pdfFunctions.ts:42

***

### range

> `readonly` **range**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:46

Output range `[min0 max0 …]`, two entries per output component.

***

### samples

> `readonly` **samples**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:55

Flat list of sample component values, row-major, first input dimension
varying fastest, output components grouped per grid point.

***

### size

> `readonly` **size**: readonly `number`[]

Defined in: src/core/pdfFunctions.ts:48

Number of samples in each input dimension.
