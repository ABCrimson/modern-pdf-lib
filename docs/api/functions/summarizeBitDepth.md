[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / summarizeBitDepth

# Function: summarizeBitDepth()

```ts
function summarizeBitDepth(depths): BitDepthInfo;
```

Defined in: [src/parser/jpeg2000BitDepth.ts:393](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000BitDepth.ts#L393)

Create a BitDepthInfo summary from component depth descriptors.

If all components share the same bit depth and signedness, the result
uses those values.  Otherwise, the maximum bit depth and the logical
OR of all signed flags are used.

## Parameters

### depths

`ComponentDepth`[]

Per-component depth descriptors from
  [getComponentDepths](getComponentDepths.md).

## Returns

`BitDepthInfo`

A summary object.
