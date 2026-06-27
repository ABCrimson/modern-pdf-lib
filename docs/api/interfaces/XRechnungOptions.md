[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / XRechnungOptions

# Interface: XRechnungOptions

Defined in: [src/compliance/xRechnung.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xRechnung.ts#L37)

Additional XRechnung-specific options layered on top of [Invoice](Invoice.md).

## Properties

### buyerReference?

```ts
readonly optional buyerReference?: string;
```

Defined in: [src/compliance/xRechnung.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xRechnung.ts#L48)

Buyer reference (BT-10). Falls back to [XRechnungOptions.leitwegId](#leitwegid)
when omitted, since XRechnung carries the Leitweg-ID as BuyerReference.

***

### leitwegId?

```ts
readonly optional leitwegId?: string;
```

Defined in: [src/compliance/xRechnung.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xRechnung.ts#L43)

Leitweg-ID (BT-DE-15 BuyerReference): the German routing identifier
addressing the public-sector buyer. Mandatory for XRechnung in
practice; emitted as the CII BuyerReference when provided.
