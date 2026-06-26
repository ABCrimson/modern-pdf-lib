[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StripResult

# Interface: StripResult

Defined in: [src/compliance/stripProhibited.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/stripProhibited.ts#L25)

Result returned by [stripProhibitedFeatures](../functions/stripProhibitedFeatures.md).

## Properties

### bytes

```ts
readonly bytes: Uint8Array;
```

Defined in: [src/compliance/stripProhibited.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/stripProhibited.ts#L27)

Modified PDF bytes.

***

### modified

```ts
readonly modified: boolean;
```

Defined in: [src/compliance/stripProhibited.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/stripProhibited.ts#L31)

Whether any modifications were made.

***

### stripped

```ts
readonly stripped: StrippedFeature[];
```

Defined in: [src/compliance/stripProhibited.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/stripProhibited.ts#L29)

Features that were stripped.
