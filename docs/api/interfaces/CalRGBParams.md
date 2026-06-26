[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CalRGBParams

# Interface: CalRGBParams

Defined in: [src/core/colorSpacesCIE.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L40)

Parameters for a CalRGB colour space (ISO 32000-2 §8.6.5.3).

## Properties

### blackPoint?

```ts
readonly optional blackPoint?: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L44)

Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`.

***

### gamma?

```ts
readonly optional gamma?: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L46)

Per-component gamma `[GR GG GB]`; defaults to `[1 1 1]`.

***

### matrix?

```ts
readonly optional matrix?: readonly number[];
```

Defined in: [src/core/colorSpacesCIE.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L48)

3×3 linear transform (9 numbers, column-major); defaults to identity.

***

### whitePoint

```ts
readonly whitePoint: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L42)

Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0.
