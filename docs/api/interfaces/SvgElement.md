[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SvgElement

# Interface: SvgElement

Defined in: [src/assets/svg/svgParser.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L75)

Parsed representation of an SVG element.

## Properties

### attributes

```ts
attributes: Record<string, string>;
```

Defined in: [src/assets/svg/svgParser.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L77)

***

### children

```ts
children: SvgElement[];
```

Defined in: [src/assets/svg/svgParser.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L78)

***

### commands?

```ts
optional commands?: SvgDrawCommand[];
```

Defined in: [src/assets/svg/svgParser.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L79)

***

### fill?

```ts
optional fill?: object;
```

Defined in: [src/assets/svg/svgParser.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L80)

#### a?

```ts
optional a?: number;
```

#### b

```ts
b: number;
```

#### g

```ts
g: number;
```

#### r

```ts
r: number;
```

***

### fillGradientId?

```ts
optional fillGradientId?: string;
```

Defined in: [src/assets/svg/svgParser.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L112)

Fill gradient reference (resolved from `fill="url(#id)"`).

***

### fillRule?

```ts
optional fillRule?: "nonzero" | "evenodd";
```

Defined in: [src/assets/svg/svgParser.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L86)

`evenodd` or `nonzero` (default).

***

### fontFamily?

```ts
optional fontFamily?: string;
```

Defined in: [src/assets/svg/svgParser.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L100)

Font family name.

***

### fontSize?

```ts
optional fontSize?: number;
```

Defined in: [src/assets/svg/svgParser.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L102)

Font size in SVG user units.

***

### fontStyle?

```ts
optional fontStyle?: string;
```

Defined in: [src/assets/svg/svgParser.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L106)

Font style (e.g. `italic`, `normal`).

***

### fontWeight?

```ts
optional fontWeight?: string;
```

Defined in: [src/assets/svg/svgParser.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L104)

Font weight (e.g. `bold`, `normal`, or numeric).

***

### gradients?

```ts
optional gradients?: Map<string, SvgGradient>;
```

Defined in: [src/assets/svg/svgParser.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L110)

Gradient definitions found in `<defs>` blocks, keyed by id.

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/assets/svg/svgParser.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L84)

***

### stroke?

```ts
optional stroke?: object;
```

Defined in: [src/assets/svg/svgParser.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L81)

#### a?

```ts
optional a?: number;
```

#### b

```ts
b: number;
```

#### g

```ts
g: number;
```

#### r

```ts
r: number;
```

***

### strokeDasharray?

```ts
optional strokeDasharray?: number[];
```

Defined in: [src/assets/svg/svgParser.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L94)

SVG `stroke-dasharray` as numeric array.

***

### strokeDashoffset?

```ts
optional strokeDashoffset?: number;
```

Defined in: [src/assets/svg/svgParser.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L96)

SVG `stroke-dashoffset`.

***

### strokeGradientId?

```ts
optional strokeGradientId?: string;
```

Defined in: [src/assets/svg/svgParser.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L114)

Stroke gradient reference (resolved from `stroke="url(#id)"`).

***

### strokeLinecap?

```ts
optional strokeLinecap?: "butt" | "round" | "square";
```

Defined in: [src/assets/svg/svgParser.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L88)

SVG `stroke-linecap`: butt | round | square.

***

### strokeLinejoin?

```ts
optional strokeLinejoin?: "round" | "miter" | "bevel";
```

Defined in: [src/assets/svg/svgParser.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L90)

SVG `stroke-linejoin`: miter | round | bevel.

***

### strokeMiterlimit?

```ts
optional strokeMiterlimit?: number;
```

Defined in: [src/assets/svg/svgParser.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L92)

SVG `stroke-miterlimit`.

***

### strokeWidth?

```ts
optional strokeWidth?: number;
```

Defined in: [src/assets/svg/svgParser.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L82)

***

### tag

```ts
tag: string;
```

Defined in: [src/assets/svg/svgParser.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L76)

***

### textAnchor?

```ts
optional textAnchor?: "start" | "middle" | "end";
```

Defined in: [src/assets/svg/svgParser.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L108)

Text anchor: start | middle | end.

***

### textContent?

```ts
optional textContent?: string;
```

Defined in: [src/assets/svg/svgParser.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L98)

Text content for `<text>` / `<tspan>` elements.

***

### transform?

```ts
optional transform?: [number, number, number, number, number, number];
```

Defined in: [src/assets/svg/svgParser.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L83)
