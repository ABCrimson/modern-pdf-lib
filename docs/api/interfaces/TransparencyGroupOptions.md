[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyGroupOptions

# Interface: TransparencyGroupOptions

Defined in: [src/core/pdfPage.ts:579](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L579)

Options for transparency groups.

Transparency groups allow a set of drawing operations to be composited
as a single unit before being blended with the page content.

## Properties

### colorSpace?

```ts
optional colorSpace?: "DeviceCMYK" | "DeviceRGB" | "DeviceGray";
```

Defined in: [src/core/pdfPage.ts:593](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L593)

Color space for the transparency group.  Default: `'DeviceRGB'`.

***

### isolated?

```ts
optional isolated?: boolean;
```

Defined in: [src/core/pdfPage.ts:584](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L584)

When `true`, the group is composited against a fully transparent
backdrop rather than the existing page content.  Default: `true`.

***

### knockout?

```ts
optional knockout?: boolean;
```

Defined in: [src/core/pdfPage.ts:589](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L589)

When `true`, earlier objects in the group are knocked out (replaced)
by later objects, rather than composited on top.  Default: `false`.
