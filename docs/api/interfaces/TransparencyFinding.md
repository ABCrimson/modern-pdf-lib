[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyFinding

# Interface: TransparencyFinding

Defined in: [src/compliance/transparencyFlattener.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/transparencyFlattener.ts#L35)

A single transparency finding with type, value, and byte position.

## Properties

### position

```ts
readonly position: number;
```

Defined in: [src/compliance/transparencyFlattener.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/transparencyFlattener.ts#L38)

***

### type

```ts
readonly type: "fill-opacity" | "stroke-opacity" | "soft-mask" | "blend-mode";
```

Defined in: [src/compliance/transparencyFlattener.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/transparencyFlattener.ts#L36)

***

### value

```ts
readonly value: string;
```

Defined in: [src/compliance/transparencyFlattener.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/transparencyFlattener.ts#L37)
