[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CIDFontData

# Interface: CIDFontData

Defined in: [src/assets/font/fontEmbed.ts:479](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L479)

Data for the CIDFont (DescendantFont) dictionary.

## Properties

### baseFont

```ts
readonly baseFont: string;
```

Defined in: [src/assets/font/fontEmbed.ts:481](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L481)

***

### cidSystemInfo

```ts
readonly cidSystemInfo: CIDSystemInfoData;
```

Defined in: [src/assets/font/fontEmbed.ts:482](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L482)

***

### defaultWidth

```ts
readonly defaultWidth: number;
```

Defined in: [src/assets/font/fontEmbed.ts:489](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L489)

***

### subtype

```ts
readonly subtype: "CIDFontType2";
```

Defined in: [src/assets/font/fontEmbed.ts:480](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L480)

***

### wArray

```ts
readonly wArray: readonly WidthEntry[];
```

Defined in: [src/assets/font/fontEmbed.ts:488](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L488)

The /W (widths) array entries.  Each entry is either:
- `[cid, [w1, w2, ...]]` — individual widths starting at `cid`
- `[cidFirst, cidLast, width]` — range with uniform width
