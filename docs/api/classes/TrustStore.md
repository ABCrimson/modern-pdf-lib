[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TrustStore

# Class: TrustStore

Defined in: [src/signature/trustStore.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L154)

A custom trust store for managing trusted root CA certificates.

Certificates are stored in a Map keyed by a SHA-256 hash of their
DER-encoded subject Name, enabling O(1) issuer lookups.

## Example

```ts
import { TrustStore } from 'modern-pdf-lib';

const store = new TrustStore();
store.addCertificate(rootCaDer);

if (store.isTrusted(someCert)) {
  console.log('Certificate is a trusted root');
}

const issuer = store.findIssuer(leafCert);
if (issuer) {
  console.log('Found issuer in trust store');
}
```

## Constructors

### Constructor

```ts
new TrustStore(options?): TrustStore;
```

Defined in: [src/signature/trustStore.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L175)

Create a new TrustStore, optionally pre-populated with certificates.

#### Parameters

##### options?

`TrustStoreOptions`

Optional configuration including initial certificates.

#### Returns

`TrustStore`

## Accessors

### size

#### Get Signature

```ts
get size(): number;
```

Defined in: [src/signature/trustStore.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L293)

The number of certificates in the trust store.

##### Returns

`number`

## Methods

### addCertificate()

```ts
addCertificate(cert): Promise<void>;
```

Defined in: [src/signature/trustStore.ts:192](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L192)

Add a trusted root certificate to the store.

#### Parameters

##### cert

`Uint8Array`

DER-encoded X.509 certificate.

#### Returns

`Promise`\&lt;`void`\&gt;

***

### addCertificates()

```ts
addCertificates(certs): Promise<void>;
```

Defined in: [src/signature/trustStore.ts:202](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L202)

Add multiple trusted root certificates to the store.

#### Parameters

##### certs

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]

Array of DER-encoded X.509 certificates.

#### Returns

`Promise`\&lt;`void`\&gt;

***

### clear()

```ts
clear(): Promise<void>;
```

Defined in: [src/signature/trustStore.ts:300](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L300)

Remove all certificates from the trust store.

#### Returns

`Promise`\&lt;`void`\&gt;

***

### findIssuer()

```ts
findIssuer(cert): Promise<Uint8Array<ArrayBufferLike> | null>;
```

Defined in: [src/signature/trustStore.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L261)

Find the issuer certificate for the given certificate.

Looks up the certificate's issuer Name in the store (by subject hash)
and returns the first matching trusted certificate, or `null` if
no issuer is found.

#### Parameters

##### cert

`Uint8Array`

DER-encoded X.509 certificate whose issuer to find.

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt; \| `null`\&gt;

The DER-encoded issuer certificate, or `null`.

***

### getAllCertificates()

```ts
getAllCertificates(): Promise<Uint8Array<ArrayBufferLike>[]>;
```

Defined in: [src/signature/trustStore.ts:278](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L278)

Get all certificates in the trust store.

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]\&gt;

Array of DER-encoded X.509 certificates.

***

### isTrusted()

```ts
isTrusted(cert): Promise<boolean>;
```

Defined in: [src/signature/trustStore.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L240)

Check if a certificate is in the trust store (exact DER match).

#### Parameters

##### cert

`Uint8Array`

DER-encoded X.509 certificate.

#### Returns

`Promise`\&lt;`boolean`\&gt;

`true` if the certificate is trusted.

***

### removeCertificate()

```ts
removeCertificate(serialNumber): Promise<boolean>;
```

Defined in: [src/signature/trustStore.ts:214](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/trustStore.ts#L214)

Remove a certificate from the store by its serial number.

#### Parameters

##### serialNumber

`Uint8Array`

The DER-encoded INTEGER serial number
                     (raw bytes, without ASN.1 tag/length).

#### Returns

`Promise`\&lt;`boolean`\&gt;

`true` if a certificate was removed.
