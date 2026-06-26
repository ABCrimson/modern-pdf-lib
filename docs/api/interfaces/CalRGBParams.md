[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CalRGBParams

# Interface: CalRGBParams

Defined in: src/core/colorSpacesCIE.ts:40

Parameters for a CalRGB colour space (ISO 32000-2 §8.6.5.3).

## Properties

### blackPoint?

> `readonly` `optional` **blackPoint?**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:44

Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`.

***

### gamma?

> `readonly` `optional` **gamma?**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:46

Per-component gamma `[GR GG GB]`; defaults to `[1 1 1]`.

***

### matrix?

> `readonly` `optional` **matrix?**: readonly `number`[]

Defined in: src/core/colorSpacesCIE.ts:48

3×3 linear transform (9 numbers, column-major); defaults to identity.

***

### whitePoint

> `readonly` **whitePoint**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:42

Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0.
