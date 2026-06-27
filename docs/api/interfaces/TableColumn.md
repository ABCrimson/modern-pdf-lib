[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TableColumn

# Interface: TableColumn

Defined in: [src/layout/table.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L86)

Column definition.

## Properties

### align?

```ts
readonly optional align?: "left" | "center" | "right";
```

Defined in: [src/layout/table.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L97)

***

### autoFit?

```ts
readonly optional autoFit?: boolean;
```

Defined in: [src/layout/table.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L94)

Auto-fit: measure content and use minimum needed width.

***

### flex?

```ts
readonly optional flex?: number;
```

Defined in: [src/layout/table.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L92)

Flex weight (like CSS flex-grow). Default: 1 when no width/percentage.

***

### maxWidth?

```ts
readonly optional maxWidth?: number;
```

Defined in: [src/layout/table.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L96)

***

### minWidth?

```ts
readonly optional minWidth?: number;
```

Defined in: [src/layout/table.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L95)

***

### percentage?

```ts
readonly optional percentage?: string;
```

Defined in: [src/layout/table.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L90)

Percentage of table width (e.g., '30%').

***

### width?

```ts
readonly optional width?: number;
```

Defined in: [src/layout/table.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L88)

Fixed width in points.
