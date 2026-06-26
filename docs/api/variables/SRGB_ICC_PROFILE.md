[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SRGB\_ICC\_PROFILE

# Variable: SRGB\_ICC\_PROFILE

> `const` **SRGB\_ICC\_PROFILE**: `Uint8Array`

Defined in: [src/compliance/srgbIccProfile.ts:385](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/compliance/srgbIccProfile.ts#L385)

Pre-generated sRGB ICC profile (cached).

This is computed once at module load time. The profile is a minimal
valid ICC v2.1.0 sRGB profile suitable for embedding in PDF/A
OutputIntent dictionaries.
