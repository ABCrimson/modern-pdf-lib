[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPermissionFlags

# Interface: PdfPermissionFlags

Defined in: [src/crypto/permissions.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L78)

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

> `optional` **annotating**: `boolean`

Defined in: [src/crypto/permissions.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L82)

***

### contentAccessibility?

> `optional` **contentAccessibility**: `boolean`

Defined in: [src/crypto/permissions.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L84)

***

### copying?

> `optional` **copying**: `boolean`

Defined in: [src/crypto/permissions.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L81)

***

### documentAssembly?

> `optional` **documentAssembly**: `boolean`

Defined in: [src/crypto/permissions.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L85)

***

### fillingForms?

> `optional` **fillingForms**: `boolean`

Defined in: [src/crypto/permissions.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L83)

***

### modifying?

> `optional` **modifying**: `boolean`

Defined in: [src/crypto/permissions.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L80)

***

### printing?

> `optional` **printing**: `boolean` \| `"lowResolution"`

Defined in: [src/crypto/permissions.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/crypto/permissions.ts#L79)
