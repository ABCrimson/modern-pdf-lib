[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SvgElement

# Interface: SvgElement

Defined in: [src/assets/svg/svgParser.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L38)

Parsed representation of an SVG element.

## Properties

### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: [src/assets/svg/svgParser.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L40)

***

### children

> **children**: `SvgElement`[]

Defined in: [src/assets/svg/svgParser.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L41)

***

### commands?

> `optional` **commands**: [`SvgDrawCommand`](SvgDrawCommand.md)[]

Defined in: [src/assets/svg/svgParser.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L42)

***

### fill?

> `optional` **fill**: `object`

Defined in: [src/assets/svg/svgParser.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L43)

#### a?

> `optional` **a**: `number`

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### fillRule?

> `optional` **fillRule**: `"nonzero"` \| `"evenodd"`

Defined in: [src/assets/svg/svgParser.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L49)

`evenodd` or `nonzero` (default).

***

### fontFamily?

> `optional` **fontFamily**: `string`

Defined in: [src/assets/svg/svgParser.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L63)

Font family name.

***

### fontSize?

> `optional` **fontSize**: `number`

Defined in: [src/assets/svg/svgParser.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L65)

Font size in SVG user units.

***

### fontStyle?

> `optional` **fontStyle**: `string`

Defined in: [src/assets/svg/svgParser.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L69)

Font style (e.g. `italic`, `normal`).

***

### fontWeight?

> `optional` **fontWeight**: `string`

Defined in: [src/assets/svg/svgParser.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L67)

Font weight (e.g. `bold`, `normal`, or numeric).

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/assets/svg/svgParser.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L47)

***

### stroke?

> `optional` **stroke**: `object`

Defined in: [src/assets/svg/svgParser.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L44)

#### a?

> `optional` **a**: `number`

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### strokeDasharray?

> `optional` **strokeDasharray**: `number`[]

Defined in: [src/assets/svg/svgParser.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L57)

SVG `stroke-dasharray` as numeric array.

***

### strokeDashoffset?

> `optional` **strokeDashoffset**: `number`

Defined in: [src/assets/svg/svgParser.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L59)

SVG `stroke-dashoffset`.

***

### strokeLinecap?

> `optional` **strokeLinecap**: `"butt"` \| `"round"` \| `"square"`

Defined in: [src/assets/svg/svgParser.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L51)

SVG `stroke-linecap`: butt | round | square.

***

### strokeLinejoin?

> `optional` **strokeLinejoin**: `"round"` \| `"miter"` \| `"bevel"`

Defined in: [src/assets/svg/svgParser.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L53)

SVG `stroke-linejoin`: miter | round | bevel.

***

### strokeMiterlimit?

> `optional` **strokeMiterlimit**: `number`

Defined in: [src/assets/svg/svgParser.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L55)

SVG `stroke-miterlimit`.

***

### strokeWidth?

> `optional` **strokeWidth**: `number`

Defined in: [src/assets/svg/svgParser.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L45)

***

### tag

> **tag**: `string`

Defined in: [src/assets/svg/svgParser.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L39)

***

### textAnchor?

> `optional` **textAnchor**: `"start"` \| `"middle"` \| `"end"`

Defined in: [src/assets/svg/svgParser.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L71)

Text anchor: start | middle | end.

***

### textContent?

> `optional` **textContent**: `string`

Defined in: [src/assets/svg/svgParser.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L61)

Text content for `<text>` / `<tspan>` elements.

***

### transform?

> `optional` **transform**: \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/assets/svg/svgParser.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/svg/svgParser.ts#L46)
