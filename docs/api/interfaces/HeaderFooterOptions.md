[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / HeaderFooterOptions

# Interface: HeaderFooterOptions

Defined in: [src/layout/headerFooter.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L38)

## Properties

### dateFormat?

```ts
optional dateFormat?: string;
```

Defined in: [src/layout/headerFooter.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L50)

Date format string. Default: 'YYYY-MM-DD'

***

### footer?

```ts
optional footer?: HeaderFooterContent[];
```

Defined in: [src/layout/headerFooter.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L40)

***

### header?

```ts
optional header?: HeaderFooterContent[];
```

Defined in: [src/layout/headerFooter.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L39)

***

### margins?

```ts
optional margins?: object;
```

Defined in: [src/layout/headerFooter.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L42)

Margins from page edge in points. Default: &#123; top: 36, bottom: 36, left: 50, right: 50 &#125;

#### bottom?

```ts
optional bottom?: number;
```

#### left?

```ts
optional left?: number;
```

#### right?

```ts
optional right?: number;
```

#### top?

```ts
optional top?: number;
```

***

### pageRange?

```ts
optional pageRange?: object;
```

Defined in: [src/layout/headerFooter.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L46)

Page range to apply to. Default: all pages.

#### end?

```ts
optional end?: number;
```

#### start?

```ts
optional start?: number;
```

***

### separatorLine?

```ts
optional separatorLine?: object;
```

Defined in: [src/layout/headerFooter.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L48)

Separator line between header/footer and content.

#### color?

```ts
optional color?: Color;
```

#### dashPattern?

```ts
optional dashPattern?: number[];
```

#### width?

```ts
optional width?: number;
```

***

### skipFirstPage?

```ts
optional skipFirstPage?: boolean;
```

Defined in: [src/layout/headerFooter.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L44)

Skip first page (e.g. for title page). Default: false
