[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TableCell

# Interface: TableCell

Defined in: [src/layout/table.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L57)

Single table cell.

## Properties

### align?

```ts
readonly optional align?: "left" | "center" | "right";
```

Defined in: [src/layout/table.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L64)

***

### backgroundColor?

```ts
readonly optional backgroundColor?: Color;
```

Defined in: [src/layout/table.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L61)

***

### colSpan?

```ts
readonly optional colSpan?: number;
```

Defined in: [src/layout/table.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L59)

***

### content

```ts
readonly content: CellContent;
```

Defined in: [src/layout/table.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L58)

***

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/layout/table.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L63)

***

### overflow?

```ts
readonly optional overflow?: "wrap" | "truncate" | "ellipsis" | "shrink";
```

Defined in: [src/layout/table.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L75)

Text overflow mode. Default: 'truncate'.

***

### padding?

```ts
readonly optional padding?: 
  | number
  | {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
};
```

Defined in: [src/layout/table.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L66)

***

### rowSpan?

```ts
readonly optional rowSpan?: number;
```

Defined in: [src/layout/table.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L60)

***

### textColor?

```ts
readonly optional textColor?: Color;
```

Defined in: [src/layout/table.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L62)

***

### verticalAlign?

```ts
readonly optional verticalAlign?: "middle" | "top" | "bottom";
```

Defined in: [src/layout/table.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L65)
