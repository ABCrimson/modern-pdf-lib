[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FetchLikeResponse

# Interface: FetchLikeResponse

Defined in: src/runtime/rangeFetch.ts:31

Minimal response shape consumed by the range fetcher. A subset of the
standard `Response` interface, declared explicitly so non-`fetch`
transports can be injected.

## Properties

### headers

> `readonly` **headers**: `object`

Defined in: src/runtime/rangeFetch.ts:35

Response headers accessor.

#### get()

> **get**(`name`): `string` \| `null`

##### Parameters

###### name

`string`

##### Returns

`string` \| `null`

***

### status

> `readonly` **status**: `number`

Defined in: src/runtime/rangeFetch.ts:33

HTTP status code (e.g. `200`, `206`).

## Methods

### arrayBuffer()

> **arrayBuffer**(): `Promise`\<`ArrayBuffer`\>

Defined in: src/runtime/rangeFetch.ts:37

Resolve the body as an ArrayBuffer.

#### Returns

`Promise`\<`ArrayBuffer`\>
