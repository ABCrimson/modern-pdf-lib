[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SRGB\_ICC\_PROFILE

# Variable: SRGB\_ICC\_PROFILE

```ts
const SRGB_ICC_PROFILE: Uint8Array;
```

Defined in: [src/compliance/srgbIccProfile.ts:385](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/srgbIccProfile.ts#L385)

Pre-generated sRGB ICC profile (cached).

This is computed once at module load time. The profile is a minimal
valid ICC v2.1.0 sRGB profile suitable for embedding in PDF/A
OutputIntent dictionaries.
