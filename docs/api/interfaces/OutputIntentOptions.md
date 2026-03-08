[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OutputIntentOptions

# Interface: OutputIntentOptions

Defined in: [src/compliance/outputIntent.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L30)

Options for building a PDF/A output intent.

## Properties

### components?

> `optional` **components**: `number`

Defined in: [src/compliance/outputIntent.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L87)

Number of color components in the ICC profile.

Must match the profile's color space:
- 3 for RGB profiles
- 4 for CMYK profiles
- 1 for Gray profiles

#### Default

```ts
3
```

***

### iccProfile?

> `optional` **iccProfile**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/compliance/outputIntent.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L75)

Custom ICC profile bytes to embed instead of the built-in sRGB profile.

When provided, the caller is responsible for ensuring the profile
is valid and matches the declared output condition.

#### Default

```ts
Built-in minimal sRGB ICC v2 profile.
```

***

### outputCondition?

> `optional` **outputCondition**: `string`

Defined in: [src/compliance/outputIntent.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L48)

Human-readable output condition description.

#### Default

```ts
'sRGB'
```

***

### outputConditionIdentifier?

> `optional` **outputConditionIdentifier**: `string`

Defined in: [src/compliance/outputIntent.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L58)

Formal registry identifier for the output condition.

This should match a well-known profile identifier from the
ICC profile registry or a vendor-specific identifier.

#### Default

```ts
'sRGB IEC61966-2.1'
```

***

### registryName?

> `optional` **registryName**: `string`

Defined in: [src/compliance/outputIntent.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L65)

URL of the ICC profile registry.

#### Default

```ts
'http://www.color.org'
```

***

### subtype?

> `optional` **subtype**: `string`

Defined in: [src/compliance/outputIntent.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L41)

Output intent subtype.

Common values:
- `/GTS_PDFA1` — PDF/A-1 (default)
- `/GTS_PDFX` — PDF/X
- `/ISO_PDFE1` — PDF/E

#### Default

```ts
'/GTS_PDFA1'
```
