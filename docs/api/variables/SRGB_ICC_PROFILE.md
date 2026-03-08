[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SRGB\_ICC\_PROFILE

# Variable: SRGB\_ICC\_PROFILE

> `const` **SRGB\_ICC\_PROFILE**: `Uint8Array`

Defined in: [src/compliance/srgbIccProfile.ts:385](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/compliance/srgbIccProfile.ts#L385)

Pre-generated sRGB ICC profile (cached).

This is computed once at module load time. The profile is a minimal
valid ICC v2.1.0 sRGB profile suitable for embedding in PDF/A
OutputIntent dictionaries.
