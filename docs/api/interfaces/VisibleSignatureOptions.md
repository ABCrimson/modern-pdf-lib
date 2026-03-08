[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / VisibleSignatureOptions

# Interface: VisibleSignatureOptions

Defined in: [src/signature/signatureHandler.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L26)

Options for a visible signature appearance on the page.

## Properties

### backgroundColor?

> `optional` **backgroundColor**: \[`number`, `number`, `number`\]

Defined in: [src/signature/signatureHandler.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L42)

Background color as [r, g, b] values (0–1). Default: transparent.

***

### borderColor?

> `optional` **borderColor**: \[`number`, `number`, `number`\]

Defined in: [src/signature/signatureHandler.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L46)

Border color as [r, g, b] values (0–1). Default: [0, 0, 0] (black).

***

### borderWidth?

> `optional` **borderWidth**: `number`

Defined in: [src/signature/signatureHandler.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L48)

Border width in points. Default: 1. Set to 0 for no border.

***

### fontSize?

> `optional` **fontSize**: `number`

Defined in: [src/signature/signatureHandler.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L38)

Font size for the text. Default: 10.

***

### pageIndex?

> `optional` **pageIndex**: `number`

Defined in: [src/signature/signatureHandler.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L28)

Zero-based page index where the signature should appear. Default: 0.

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/signature/signatureHandler.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L30)

Rectangle [x, y, width, height] in PDF points from the bottom-left corner.

***

### text?

> `optional` **text**: `string`[]

Defined in: [src/signature/signatureHandler.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/signatureHandler.ts#L36)

Text lines to display in the signature box.
Each string becomes a separate line. If omitted, auto-generates
from the signer name, reason, location, and date.
