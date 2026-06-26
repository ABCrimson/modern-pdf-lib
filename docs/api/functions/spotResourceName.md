[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / spotResourceName

# Function: spotResourceName()

```ts
function spotResourceName(colorantName): string;
```

Defined in: [src/core/operators/color.ts:464](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/color.ts#L464)

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
