[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildSeparationColorSpace

# Function: buildSeparationColorSpace()

> **buildSeparationColorSpace**(`name`, `alternate`): [`PdfArray`](../classes/PdfArray.md)

Defined in: [src/core/operators/spotColor.ts:188](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/spotColor.ts#L188)

Build a Separation colour space array for a spot colour.

The returned `PdfArray` has the structure:
```
[/Separation /ColorantName /DeviceCMYK <tint-transform-function>]
```

This array should be registered as a page colour space resource
under the name returned by [spotResourceName](spotResourceName.md).

## Parameters

### name

`string`

Colorant name (e.g. `'PANTONE 185 C'`).

### alternate

[`RgbColor`](../interfaces/RgbColor.md) \| [`CmykColor`](../interfaces/CmykColor.md) \| [`GrayscaleColor`](../interfaces/GrayscaleColor.md)

The fallback colour whose space and values define
                  the tint-transform mapping.

## Returns

[`PdfArray`](../classes/PdfArray.md)

A `PdfArray` representing the Separation colour space.

## Example

```ts
import { buildSeparationColorSpace, cmyk, spotResourceName } from 'modern-pdf-lib';

const pantone = cmyk(0, 0.91, 0.76, 0);
const csArray = buildSeparationColorSpace('PANTONE 185 C', pantone);
// Register as page resource:
//   page.node.get('/Resources').get('/ColorSpace').set(
//     `/${spotResourceName('PANTONE 185 C')}`, csArray
//   );
```
