[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CatalogOptions

# Interface: CatalogOptions

Defined in: [src/core/pdfCatalog.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L249)

Options for building the catalog.

## Properties

### lang?

```ts
optional lang?: string;
```

Defined in: [src/core/pdfCatalog.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L269)

The natural language of the document content (e.g. `en-US`).

***

### pageLayout?

```ts
optional pageLayout?: 
  | "SinglePage"
  | "OneColumn"
  | "TwoColumnLeft"
  | "TwoColumnRight"
  | "TwoPageLeft"
  | "TwoPageRight";
```

Defined in: [src/core/pdfCatalog.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L251)

Page layout hint.

***

### pageMode?

```ts
optional pageMode?: 
  | "UseNone"
  | "UseOutlines"
  | "UseThumbs"
  | "FullScreen"
  | "UseOC"
  | "UseAttachments";
```

Defined in: [src/core/pdfCatalog.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L260)

Page mode hint.
