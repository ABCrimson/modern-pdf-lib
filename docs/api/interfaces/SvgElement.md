[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SvgElement

# Interface: SvgElement

Defined in: [src/assets/svg/svgParser.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L75)

Parsed representation of an SVG element.

## Properties

### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: [src/assets/svg/svgParser.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L77)

***

### children

> **children**: `SvgElement`[]

Defined in: [src/assets/svg/svgParser.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L78)

***

### commands?

> `optional` **commands?**: [`SvgDrawCommand`](SvgDrawCommand.md)[]

Defined in: [src/assets/svg/svgParser.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L79)

***

### fill?

> `optional` **fill?**: `object`

Defined in: [src/assets/svg/svgParser.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L80)

#### a?

> `optional` **a?**: `number`

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### fillGradientId?

> `optional` **fillGradientId?**: `string`

Defined in: [src/assets/svg/svgParser.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L112)

Fill gradient reference (resolved from `fill="url(#id)"`).

***

### fillRule?

> `optional` **fillRule?**: `"nonzero"` \| `"evenodd"`

Defined in: [src/assets/svg/svgParser.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L86)

`evenodd` or `nonzero` (default).

***

### fontFamily?

> `optional` **fontFamily?**: `string`

Defined in: [src/assets/svg/svgParser.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L100)

Font family name.

***

### fontSize?

> `optional` **fontSize?**: `number`

Defined in: [src/assets/svg/svgParser.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L102)

Font size in SVG user units.

***

### fontStyle?

> `optional` **fontStyle?**: `string`

Defined in: [src/assets/svg/svgParser.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L106)

Font style (e.g. `italic`, `normal`).

***

### fontWeight?

> `optional` **fontWeight?**: `string`

Defined in: [src/assets/svg/svgParser.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L104)

Font weight (e.g. `bold`, `normal`, or numeric).

***

### gradients?

> `optional` **gradients?**: `Map`\<`string`, [`SvgGradient`](SvgGradient.md)\>

Defined in: [src/assets/svg/svgParser.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L110)

Gradient definitions found in `<defs>` blocks, keyed by id.

***

### opacity?

> `optional` **opacity?**: `number`

Defined in: [src/assets/svg/svgParser.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L84)

***

### stroke?

> `optional` **stroke?**: `object`

Defined in: [src/assets/svg/svgParser.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L81)

#### a?

> `optional` **a?**: `number`

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### strokeDasharray?

> `optional` **strokeDasharray?**: `number`[]

Defined in: [src/assets/svg/svgParser.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L94)

SVG `stroke-dasharray` as numeric array.

***

### strokeDashoffset?

> `optional` **strokeDashoffset?**: `number`

Defined in: [src/assets/svg/svgParser.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L96)

SVG `stroke-dashoffset`.

***

### strokeGradientId?

> `optional` **strokeGradientId?**: `string`

Defined in: [src/assets/svg/svgParser.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L114)

Stroke gradient reference (resolved from `stroke="url(#id)"`).

***

### strokeLinecap?

> `optional` **strokeLinecap?**: `"butt"` \| `"round"` \| `"square"`

Defined in: [src/assets/svg/svgParser.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L88)

SVG `stroke-linecap`: butt | round | square.

***

### strokeLinejoin?

> `optional` **strokeLinejoin?**: `"round"` \| `"miter"` \| `"bevel"`

Defined in: [src/assets/svg/svgParser.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L90)

SVG `stroke-linejoin`: miter | round | bevel.

***

### strokeMiterlimit?

> `optional` **strokeMiterlimit?**: `number`

Defined in: [src/assets/svg/svgParser.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L92)

SVG `stroke-miterlimit`.

***

### strokeWidth?

> `optional` **strokeWidth?**: `number`

Defined in: [src/assets/svg/svgParser.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L82)

***

### tag

> **tag**: `string`

Defined in: [src/assets/svg/svgParser.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L76)

***

### textAnchor?

> `optional` **textAnchor?**: `"start"` \| `"middle"` \| `"end"`

Defined in: [src/assets/svg/svgParser.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L108)

Text anchor: start | middle | end.

***

### textContent?

> `optional` **textContent?**: `string`

Defined in: [src/assets/svg/svgParser.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L98)

Text content for `<text>` / `<tspan>` elements.

***

### transform?

> `optional` **transform?**: \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/assets/svg/svgParser.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L83)
