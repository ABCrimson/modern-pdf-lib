[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PDFOperator

# Class: PDFOperator

Defined in: [src/core/operators/index.ts:188](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/index.ts#L188)

A first-class representation of a single PDF content-stream operator.

In pdf-lib, operators are typed objects rather than raw strings. This
class provides the same capability while remaining interoperable with
the string-based operator functions above.

```ts
const op = PDFOperator.of('m', 100, 200);   // moveTo(100, 200)
page.pushOperators(op.toString());
```

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/core/operators/index.ts:201](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/index.ts#L201)

The PDF operator name.

***

### operands

```ts
readonly operands: readonly (string | number)[];
```

Defined in: [src/core/operators/index.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/index.ts#L203)

The operands for this operator.

## Methods

### toString()

```ts
toString(): string;
```

Defined in: [src/core/operators/index.ts:211](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/index.ts#L211)

Serialize this operator to its PDF content-stream representation.

#### Returns

`string`

A string like `"100 200 m\n"`.

***

### of()

```ts
static of(name, ...operands): PDFOperator;
```

Defined in: [src/core/operators/index.ts:195](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/index.ts#L195)

Create a new operator.

#### Parameters

##### name

`string`

The PDF operator name (e.g. `'m'`, `'l'`, `'re'`, `'Tj'`).

##### operands

...(`string` \| `number`)[]

Numeric, string, or name operands.

#### Returns

`PDFOperator`
