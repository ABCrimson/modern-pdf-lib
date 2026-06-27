[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / interpolateLinearRgb

# Function: interpolateLinearRgb()

```ts
function interpolateLinearRgb(
   c0, 
   c1, 
   t): object;
```

Defined in: [src/assets/svg/svgParser.ts:1153](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/svg/svgParser.ts#L1153)

Interpolate between two colours in linear RGB space.

Linear RGB interpolation converts sRGB (0-255) to linear light,
interpolates, then converts back. This produces perceptually
correct gradients.

## Parameters

### c0

Start colour (0-255 sRGB).

#### b

`number`

#### g

`number`

#### r

`number`

### c1

End colour (0-255 sRGB).

#### b

`number`

#### g

`number`

#### r

`number`

### t

`number`

Interpolation factor (0..1).

## Returns

`object`

Interpolated colour (0-255 sRGB).

### b

```ts
b: number;
```

### g

```ts
g: number;
```

### r

```ts
r: number;
```
