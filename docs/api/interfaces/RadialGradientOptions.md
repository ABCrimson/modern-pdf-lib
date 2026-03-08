[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RadialGradientOptions

# Interface: RadialGradientOptions

Defined in: [src/core/patterns.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L75)

Options for creating a radial gradient (radial shading, ShadingType 3).

## Properties

### extend?

> `readonly` `optional` **extend**: `boolean`

Defined in: [src/core/patterns.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L96)

Whether to extend the gradient beyond the start and end circles.
Default: `true`.

***

### r0

> `readonly` **r0**: `number`

Defined in: [src/core/patterns.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L81)

Radius of the start circle.

***

### r1

> `readonly` **r1**: `number`

Defined in: [src/core/patterns.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L87)

Radius of the end circle.

***

### stops

> `readonly` **stops**: readonly ([`Color`](../type-aliases/Color.md) \| [`ColorStop`](ColorStop.md))[]

Defined in: [src/core/patterns.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L91)

Colour stops (same semantics as [LinearGradientOptions.stops](LinearGradientOptions.md#stops)).

***

### x0

> `readonly` **x0**: `number`

Defined in: [src/core/patterns.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L77)

Centre X of the start circle.

***

### x1

> `readonly` **x1**: `number`

Defined in: [src/core/patterns.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L83)

Centre X of the end circle.

***

### y0

> `readonly` **y0**: `number`

Defined in: [src/core/patterns.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L79)

Centre Y of the start circle.

***

### y1

> `readonly` **y1**: `number`

Defined in: [src/core/patterns.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/patterns.ts#L85)

Centre Y of the end circle.
