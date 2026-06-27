[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawTableOptions

# Interface: DrawTableOptions

Defined in: [src/layout/table.ts:101](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L101)

Full table configuration.

## Properties

### alternateRowColors?

```ts
readonly optional alternateRowColors?: readonly [Color, Color];
```

Defined in: [src/layout/table.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L120)

Alternating row background colors [even, odd].

***

### borderColor?

```ts
readonly optional borderColor?: Color;
```

Defined in: [src/layout/table.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L112)

***

### borderWidth?

```ts
readonly optional borderWidth?: number;
```

Defined in: [src/layout/table.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L114)

Border line width in points, default 0.5.

***

### columns?

```ts
readonly optional columns?: readonly TableColumn[];
```

Defined in: [src/layout/table.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L106)

***

### fontName?

```ts
readonly optional fontName?: string;
```

Defined in: [src/layout/table.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L108)

PDF font resource name, default 'Helvetica'.

***

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/layout/table.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L110)

Default font size in points, default 12.

***

### headerBackgroundColor?

```ts
readonly optional headerBackgroundColor?: Color;
```

Defined in: [src/layout/table.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L122)

Header background color (overrides alternateRowColors for header rows).

***

### headerRows?

```ts
readonly optional headerRows?: number;
```

Defined in: [src/layout/table.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L116)

Number of header rows (reserved for future page-break support).

***

### headerTextColor?

```ts
readonly optional headerTextColor?: Color;
```

Defined in: [src/layout/table.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L124)

Header text color.

***

### padding?

```ts
readonly optional padding?: number;
```

Defined in: [src/layout/table.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L118)

Default cell padding in points, default 4.

***

### rows

```ts
readonly rows: readonly TableRow[];
```

Defined in: [src/layout/table.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L105)

***

### textColor?

```ts
readonly optional textColor?: Color;
```

Defined in: [src/layout/table.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L111)

***

### width

```ts
readonly width: number;
```

Defined in: [src/layout/table.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L104)

***

### x

```ts
readonly x: number;
```

Defined in: [src/layout/table.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L102)

***

### y

```ts
readonly y: number;
```

Defined in: [src/layout/table.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/table.ts#L103)
