[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPermissionFlags

# Interface: PdfPermissionFlags

Defined in: [src/crypto/permissions.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L78)

Human-friendly permission flags for a PDF document.

Each flag controls a specific capability:

- `printing`:  `true` = full quality, `'lowResolution'` = low-res only,
  `false` / `undefined` = no printing allowed.
- `modifying`: Allow content modifications.
- `copying`:   Allow text/graphics extraction.
- `annotating`: Allow adding/modifying annotations.
- `fillingForms`: Allow filling interactive form fields.
- `contentAccessibility`: Allow text extraction for accessibility.
- `documentAssembly`: Allow inserting/deleting/rotating pages.

## Properties

### annotating?

```ts
optional annotating?: boolean;
```

Defined in: [src/crypto/permissions.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L82)

***

### contentAccessibility?

```ts
optional contentAccessibility?: boolean;
```

Defined in: [src/crypto/permissions.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L84)

***

### copying?

```ts
optional copying?: boolean;
```

Defined in: [src/crypto/permissions.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L81)

***

### documentAssembly?

```ts
optional documentAssembly?: boolean;
```

Defined in: [src/crypto/permissions.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L85)

***

### fillingForms?

```ts
optional fillingForms?: boolean;
```

Defined in: [src/crypto/permissions.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L83)

***

### modifying?

```ts
optional modifying?: boolean;
```

Defined in: [src/crypto/permissions.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L80)

***

### printing?

```ts
optional printing?: boolean | "lowResolution";
```

Defined in: [src/crypto/permissions.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/crypto/permissions.ts#L79)
