[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PDFOperator

# Class: PDFOperator

Defined in: [src/core/operators/index.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/index.ts#L171)

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

> `readonly` **name**: `string`

Defined in: [src/core/operators/index.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/index.ts#L184)

The PDF operator name.

***

### operands

> `readonly` **operands**: readonly (`string` \| `number`)[]

Defined in: [src/core/operators/index.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/index.ts#L186)

The operands for this operator.

## Methods

### toString()

> **toString**(): `string`

Defined in: [src/core/operators/index.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/index.ts#L194)

Serialize this operator to its PDF content-stream representation.

#### Returns

`string`

A string like `"100 200 m\n"`.

***

### of()

> `static` **of**(`name`, ...`operands`): `PDFOperator`

Defined in: [src/core/operators/index.ts:178](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/index.ts#L178)

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
