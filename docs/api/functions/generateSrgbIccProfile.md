[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateSrgbIccProfile

# Function: generateSrgbIccProfile()

> **generateSrgbIccProfile**(): `Uint8Array`

Defined in: [src/compliance/srgbIccProfile.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/srgbIccProfile.ts#L237)

Generate a minimal sRGB ICC v2 profile.

The resulting profile is a valid ICC v2.1.0 profile containing the
minimum set of tags required for a Display profile with 'RGB ' color
space and 'XYZ ' PCS:

- `desc` — profile description ("sRGB IEC61966-2.1")
- `cprt` — copyright notice
- `wtpt` — media white point (D50)
- `rXYZ`, `gXYZ`, `bXYZ` — red/green/blue colorant XYZ values
- `rTRC`, `gTRC`, `bTRC` — red/green/blue tone response curves (gamma 2.2)

## Returns

`Uint8Array`

Raw ICC profile bytes (Uint8Array).
