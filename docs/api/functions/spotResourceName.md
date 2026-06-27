[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / spotResourceName

# Function: spotResourceName()

```ts
function spotResourceName(colorantName): string;
```

Defined in: [src/core/operators/color.ts:464](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L464)

Derive a PDF resource name from a spot colorant name.

Replaces spaces and special characters with underscores to produce
a valid PDF name.

## Parameters

### colorantName

`string`

## Returns

`string`

## Example

```ts
spotResourceName('PANTONE 185 C') // 'CS_PANTONE_185_C'
```
