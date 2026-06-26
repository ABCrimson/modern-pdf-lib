[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ContentStreamOperator

# Interface: ContentStreamOperator

Defined in: [src/parser/contentStreamParser.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/contentStreamParser.ts#L39)

A parsed content-stream operator with its preceding operands.

## Properties

### operands

```ts
operands: Operand[];
```

Defined in: [src/parser/contentStreamParser.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/contentStreamParser.ts#L43)

The operand values that preceded this operator.

***

### operator

```ts
operator: string;
```

Defined in: [src/parser/contentStreamParser.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/contentStreamParser.ts#L41)

The operator keyword, e.g. `"BT"`, `"Tf"`, `"Tj"`, `"re"`, `"cm"`.
