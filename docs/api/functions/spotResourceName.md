[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / spotResourceName

# Function: spotResourceName()

> **spotResourceName**(`colorantName`): `string`

Defined in: [src/core/operators/color.ts:464](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L464)

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
