---
title: Spot Colors & DeviceN
---

# Spot Colors & DeviceN

modern-pdf-lib provides first-class support for Separation (spot) and DeviceN (multi-ink) colour spaces, enabling print-production workflows that require named inks such as Pantone, HKS, or custom brand colours. All spot colour APIs produce native PDF colour space objects -- no rasterisation or approximation involved.

## Why Spot Colors?

Standard RGB and CMYK colour spaces describe colours by mixing device primaries. In professional print production, however, you often need a **named ink** that is mixed independently on the press:

- **Brand consistency** -- Pantone and HKS swatches guarantee identical colour across print runs
- **Special inks** -- metallic, fluorescent, or varnish coatings cannot be represented in CMYK
- **Proofing accuracy** -- PDF viewers that understand Separation colour spaces can simulate spot inks on screen using the fallback colour you provide

## Creating Spot Colors

Use the `spotColor()` constructor to define a named colorant with a device-space fallback and a tint intensity:

```ts
import { spotColor, cmyk, rgb } from 'modern-pdf-lib';

// Pantone 185 C with a CMYK fallback, full intensity
const pantoneRed = spotColor('PANTONE 185 C', cmyk(0, 0.91, 0.76, 0), 1);

// A custom brand colour with an RGB fallback at 70% tint
const brandBlue = spotColor('BrandBlue', rgb(0.1, 0.2, 0.8), 0.7);
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Colorant name (e.g. `'PANTONE 185 C'`) |
| `alternate` | `RgbColor \| CmykColor \| GrayscaleColor` | Fallback colour used when the spot ink is unavailable |
| `tint` | `number` | Tint intensity `[0, 1]` -- 0 = no ink, 1 = full ink. Default: `1` |

The `tint` value controls how much ink is applied. A tint of `0.5` produces a 50% screen of the named ink.

## DeviceN Colors (Multi-Ink)

For workflows that require **multiple named inks on a single object** (e.g. a duotone image or a spot varnish overlay), use `deviceNColor()`:

```ts
import { deviceNColor } from 'modern-pdf-lib';

// Two custom inks with a CMYK alternate space
const duotone = deviceNColor(
  ['WarmRed', 'CoolBlue'],   // colorant names
  'DeviceCMYK',               // alternate colour space
  [0.8, 0.5],                 // tint per colorant
);

// Three-ink process with an RGB alternate
const triInk = deviceNColor(
  ['Cyan', 'Magenta', 'Spot Gold'],
  'DeviceRGB',
  [1, 0.6, 0.9],
);
```

::: warning
The `colorants` and `tints` arrays must be the same length. An error is thrown if they differ.
:::

## Registering Colour Spaces as Page Resources

Spot and DeviceN colours require a corresponding colour space object registered in the page's resources. Use `buildSeparationColorSpace()` and `buildDeviceNColorSpace()` to create the PDF array objects:

```ts
import {
  createPdf,
  buildSeparationColorSpace,
  buildDeviceNColorSpace,
  spotColor,
  cmyk,
  spotResourceName,
  deviceNResourceName,
} from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage();

// 1. Build the Separation colour space array (a PdfArray object)
const pantone = cmyk(0, 0.91, 0.76, 0);
const csArray = buildSeparationColorSpace('PANTONE 185 C', pantone);

// 2. Derive the resource name used inside the content stream
const resourceName = spotResourceName('PANTONE 185 C');
// resourceName => 'CS_PANTONE_185_C'

// 3. Build a DeviceN colour space for multi-ink use
const dnArray = buildDeviceNColorSpace(
  ['WarmRed', 'CoolBlue'],
  'DeviceCMYK',
);
const dnName = deviceNResourceName(['WarmRed', 'CoolBlue']);
```

`buildSeparationColorSpace()` and `buildDeviceNColorSpace()` return native `PdfArray` colour-space objects. Register each one in the page's `/Resources` `/ColorSpace` sub-dictionary under its derived resource name so the content-stream operators below can reference it.

The `spotResourceName()` and `deviceNResourceName()` helpers sanitise colorant names into valid PDF name tokens by replacing spaces and special characters with underscores.

## Applying Spot Colors to Content

Once the colour space is registered, use the standard `applyFillColor()` and `applyStrokeColor()` operators:

```ts
import {
  spotColor,
  cmyk,
  applyFillColor,
  applyStrokeColor,
} from 'modern-pdf-lib';

const pantoneRed = spotColor('PANTONE 185 C', cmyk(0, 0.91, 0.76, 0));

// Generate the PDF content-stream operator string
const fillOps = applyFillColor(pantoneRed);
// => '/CS_PANTONE_185_C cs\n1 scn\n'

const strokeOps = applyStrokeColor(pantoneRed);
// => '/CS_PANTONE_185_C CS\n1 SCN\n'

page.pushOperators(fillOps + strokeOps);
```

For DeviceN colours, the operator emits all tint values:

```ts
import { deviceNColor, applyFillColor } from 'modern-pdf-lib';

const duo = deviceNColor(['WarmRed', 'CoolBlue'], 'DeviceCMYK', [0.8, 0.5]);
const ops = applyFillColor(duo);
// => '/CS_DN_WarmRed_CoolBlue cs\n0.8 0.5 scn\n'
```

## Colour Conversion Utilities

modern-pdf-lib provides conversion functions for moving between RGB and CMYK, and between typed `Color` values and hex strings.

### RGB to CMYK

```ts
import { rgbToCmyk } from 'modern-pdf-lib';

const [c, m, y, k] = rgbToCmyk(1, 0, 0); // Pure red
// c=0, m=1, y=1, k=0
```

### CMYK to RGB

```ts
import { cmykToRgb } from 'modern-pdf-lib';

const [r, g, b] = cmykToRgb(0, 0.91, 0.76, 0);
// r=1, g=0.09, b=0.24
```

::: tip
These conversions use the standard formulae and are device-independent approximations. For colour-critical print work, use ICC profiles and a colour management system.
:::

### HSL, HSV, XYZ and Lab

For UI colour pickers and perceptual colour work, modern-pdf-lib also converts
between sRGB and HSL, HSV, CIE XYZ (D65), and CIE L\*a\*b\*. All channels are
normalized to `0..1` except hue (degrees) and Lab (its natural ranges); the
conversions round-trip.

```ts
import { rgbToHsl, hslToRgb, rgbToHsv, rgbToLab, rgbToXyz } from 'modern-pdf-lib';

rgbToHsl(1, 0, 0);   // [0, 1, 0.5]   — hue°, saturation, lightness
rgbToHsv(1, 0, 0);   // [0, 1, 1]
rgbToXyz(1, 1, 1);   // sRGB white → CIE XYZ (D65)
rgbToLab(1, 1, 1);   // ≈ [100, 0, 0]
const back = hslToRgb(0, 1, 0.5); // → [1, 0, 0]
```

### ICC colour transforms

For matrix/TRC ICC profiles (the common RGB-display and grayscale kind, e.g.
sRGB), `parseIccTransform` reports the profile model and `deviceRgbToXyz`
evaluates device RGB through the profile's tone-reproduction curves and colorant
matrix into PCS XYZ (D50); `xyzToLab` then yields L\*a\*b\*.

```ts
import { parseIccTransform, deviceRgbToXyz, xyzToLab } from 'modern-pdf-lib';

const info = parseIccTransform(iccBytes);
// { version, deviceClass: 'mntr', colorSpace: 'RGB ', pcs: 'XYZ ', hasMatrixTrc: true }
if (info.hasMatrixTrc) {
  const xyz = deviceRgbToXyz(iccBytes, [1, 1, 1]); // ≈ D50 white [0.9642, 1.0, 0.8249]
  const lab = xyzToLab(xyz);                        // ≈ [100, 0, 0]
}
```

::: warning Scope
This evaluates **matrix/TRC** profiles. LUT-based profiles (`mft1`/`mft2`/`mAB`/
`mBA`) are detected (`hasMatrixTrc: false`) and `deviceRgbToXyz` throws a clear
error rather than returning wrong numbers — it never silently guesses. No
Bradford chromatic adaptation is applied (colorant/white-point XYZ are taken as
the D50-relative PCS values stored in the profile).
:::

### Mesh shadings (smooth gradients)

Beyond axial/radial gradients, modern-pdf-lib builds the PDF mesh shadings
(`ShadingType` 4–7) — Gouraud-shaded triangle meshes and Coons/tensor patch
meshes — for smooth multi-point colour blends. Each builder returns a
`PdfStream` whose body is the spec's bit-packed mesh data.

```ts
import {
  buildFreeFormGouraudShading,   // type 4
  buildLatticeFormGouraudShading,// type 5
  buildCoonsPatchShading,        // type 6
  buildTensorPatchShading,       // type 7
} from 'modern-pdf-lib';

const shading = buildCoonsPatchShading({
  colorSpace: PdfName.of('DeviceRGB'),
  bitsPerCoordinate: 16,
  bitsPerComponent: 8,
  bitsPerFlag: 8,
  decode: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  patches: [/* one Coons patch: 12 control points + 4 corner colours */],
});
```

Values are packed big-endian, MSB-first, and mapped through `/Decode` exactly per
ISO 32000-2 §8.7.4.5. Supply a `/Function` to drive colours from a single
parametric value `t`, or omit it to give each vertex N colour components
directly.

### Color to Hex

```ts
import { colorToHex, rgb, cmyk, grayscale, spotColor } from 'modern-pdf-lib';

colorToHex(rgb(1, 0, 0));               // '#ff0000'
colorToHex(cmyk(0, 0, 0, 0));           // '#ffffff'
colorToHex(grayscale(0.5));              // '#808080'

// Spot colours use their alternate colour for conversion
const spot = spotColor('Brand', rgb(0.2, 0.4, 0.8));
colorToHex(spot);                        // '#3366cc'
```

::: warning
`colorToHex()` throws for DeviceN colours because there is no single hex representation for multi-ink values.
:::

### Hex to Color

```ts
import { hexToColor } from 'modern-pdf-lib';

const red = hexToColor('#ff0000');   // RgbColor { r: 1, g: 0, b: 0 }
const short = hexToColor('#f00');    // Shorthand is expanded automatically
const bare = hexToColor('3366cc');   // Leading '#' is optional
```

## Low-Level Colour Operators

For full control over the PDF content stream, use the individual operator functions:

| Function | PDF Operator | Description |
|---|---|---|
| `setFillColorRgb(r, g, b)` | `rg` | Set fill colour (RGB) |
| `setFillColorCmyk(c, m, y, k)` | `k` | Set fill colour (CMYK) |
| `setFillColorGray(gray)` | `g` | Set fill colour (Grayscale) |
| `setStrokeColorRgb(r, g, b)` | `RG` | Set stroke colour (RGB) |
| `setStrokeColorCmyk(c, m, y, k)` | `K` | Set stroke colour (CMYK) |
| `setStrokeColorGray(gray)` | `G` | Set stroke colour (Grayscale) |
| `setColorSpace(name)` | `cs` | Set non-stroking colour space |
| `setStrokeColorSpace(name)` | `CS` | Set stroking colour space |
| `setFillColor(...components)` | `scn` | Set fill in current colour space |
| `setStrokeColor(...components)` | `SCN` | Set stroke in current colour space |

## Component Array Conversion

Convert between typed `Color` objects and numeric arrays:

```ts
import { componentsToColor, colorToComponents, rgb, cmyk } from 'modern-pdf-lib';

// Array to typed Color
componentsToColor([1, 0, 0]);       // RgbColor (3 components)
componentsToColor([0.5]);           // GrayscaleColor (1 component)
componentsToColor([0, 1, 1, 0]);   // CmykColor (4 components)

// Typed Color to array
colorToComponents(rgb(1, 0, 0));   // [1, 0, 0]
colorToComponents(cmyk(0, 1, 1, 0)); // [0, 1, 1, 0]
```

## Best Practices

1. **Always provide an accurate fallback colour** -- PDF viewers that do not support the named ink will render the alternate colour instead. Choose a fallback that closely matches the visual appearance of the spot ink.

2. **Use CMYK fallbacks for print workflows** -- CMYK alternates produce more accurate print simulations than RGB alternates.

3. **Register colour spaces before use** -- The Separation or DeviceN colour space array must be in the page's `/Resources/ColorSpace` dictionary before any content-stream operator references it.

4. **Use consistent colorant names** -- The name string must match exactly across all pages and colour space registrations. `'PANTONE 185 C'` and `'Pantone 185 C'` are treated as different inks.

5. **Prefer `applyFillColor()` / `applyStrokeColor()`** -- These high-level functions emit the correct operator sequence for any `Color` type, including spot and DeviceN. Use the low-level operators only when you need direct content-stream control.

6. **Validate tint values** -- All tint values are clamped to `[0, 1]`. A tint of `0` means no ink (white for Separation, or the minimum of each DeviceN channel), and `1` means full ink.
