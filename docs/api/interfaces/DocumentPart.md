[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocumentPart

# Interface: DocumentPart

Defined in: [src/core/documentParts.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/documentParts.ts#L39)

A single document part: a contiguous, inclusive range of page indices plus
optional Document Part Metadata.

## Properties

### endPage

```ts
readonly endPage: number;
```

Defined in: [src/core/documentParts.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/documentParts.ts#L43)

Zero-based index of the last page in this part (inclusive).

***

### metadata?

```ts
readonly optional metadata?: Readonly<Record<string, string>>;
```

Defined in: [src/core/documentParts.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/documentParts.ts#L48)

Optional Document Part Metadata.  Each key/value pair is emitted as a
PDF name → literal-string entry inside the part's `/DPM` dictionary.

***

### startPage

```ts
readonly startPage: number;
```

Defined in: [src/core/documentParts.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/documentParts.ts#L41)

Zero-based index of the first page in this part (inclusive).
