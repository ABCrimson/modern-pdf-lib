[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyGroupOptions

# Interface: TransparencyGroupOptions

Defined in: [src/core/pdfPage.ts:580](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L580)

Options for transparency groups.

Transparency groups allow a set of drawing operations to be composited
as a single unit before being blended with the page content.

## Properties

### colorSpace?

```ts
optional colorSpace?: "DeviceCMYK" | "DeviceRGB" | "DeviceGray";
```

Defined in: [src/core/pdfPage.ts:594](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L594)

Color space for the transparency group.  Default: `'DeviceRGB'`.

***

### isolated?

```ts
optional isolated?: boolean;
```

Defined in: [src/core/pdfPage.ts:585](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L585)

When `true`, the group is composited against a fully transparent
backdrop rather than the existing page content.  Default: `true`.

***

### knockout?

```ts
optional knockout?: boolean;
```

Defined in: [src/core/pdfPage.ts:590](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L590)

When `true`, earlier objects in the group are knocked out (replaced)
by later objects, rather than composited on top.  Default: `false`.
