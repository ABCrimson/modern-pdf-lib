[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SvgGradient

# Interface: SvgGradient

Defined in: [src/assets/svg/svgParser.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L48)

Parsed gradient definition from `<linearGradient>` or `<radialGradient>`.

## Properties

### cx?

> `optional` **cx?**: `number`

Defined in: [src/assets/svg/svgParser.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L67)

***

### cy?

> `optional` **cy?**: `number`

Defined in: [src/assets/svg/svgParser.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L68)

***

### fx?

> `optional` **fx?**: `number`

Defined in: [src/assets/svg/svgParser.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L70)

***

### fy?

> `optional` **fy?**: `number`

Defined in: [src/assets/svg/svgParser.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L71)

***

### gradientTransform?

> `optional` **gradientTransform?**: \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: [src/assets/svg/svgParser.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L60)

Optional `gradientTransform` as a 2D affine matrix [a,b,c,d,e,f].

***

### gradientUnits

> **gradientUnits**: `"objectBoundingBox"` \| `"userSpaceOnUse"`

Defined in: [src/assets/svg/svgParser.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L58)

SVG `gradientUnits`: objectBoundingBox | userSpaceOnUse. Default: objectBoundingBox.

***

### id

> **id**: `string`

Defined in: [src/assets/svg/svgParser.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L52)

Gradient XML id.

***

### r?

> `optional` **r?**: `number`

Defined in: [src/assets/svg/svgParser.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L69)

***

### spreadMethod

> **spreadMethod**: `"pad"` \| `"reflect"` \| `"repeat"`

Defined in: [src/assets/svg/svgParser.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L56)

SVG `spreadMethod`: pad | reflect | repeat. Default: pad.

***

### stops

> **stops**: [`SvgGradientStop`](SvgGradientStop.md)[]

Defined in: [src/assets/svg/svgParser.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L54)

Colour stops, sorted by offset.

***

### type

> **type**: `"linearGradient"` \| `"radialGradient"`

Defined in: [src/assets/svg/svgParser.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L50)

Gradient type.

***

### x1?

> `optional` **x1?**: `number`

Defined in: [src/assets/svg/svgParser.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L62)

***

### x2?

> `optional` **x2?**: `number`

Defined in: [src/assets/svg/svgParser.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L64)

***

### y1?

> `optional` **y1?**: `number`

Defined in: [src/assets/svg/svgParser.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L63)

***

### y2?

> `optional` **y2?**: `number`

Defined in: [src/assets/svg/svgParser.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L65)
