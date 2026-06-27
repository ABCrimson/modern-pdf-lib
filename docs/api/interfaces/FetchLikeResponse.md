[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FetchLikeResponse

# Interface: FetchLikeResponse

Defined in: [src/runtime/rangeFetch.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L31)

Minimal response shape consumed by the range fetcher. A subset of the
standard `Response` interface, declared explicitly so non-`fetch`
transports can be injected.

## Properties

### headers

```ts
readonly headers: object;
```

Defined in: [src/runtime/rangeFetch.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L35)

Response headers accessor.

#### get()

```ts
get(name): string | null;
```

##### Parameters

###### name

`string`

##### Returns

`string` \| `null`

***

### status

```ts
readonly status: number;
```

Defined in: [src/runtime/rangeFetch.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L33)

HTTP status code (e.g. `200`, `206`).

## Methods

### arrayBuffer()

```ts
arrayBuffer(): Promise<ArrayBuffer>;
```

Defined in: [src/runtime/rangeFetch.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L37)

Resolve the body as an ArrayBuffer.

#### Returns

`Promise`\&lt;`ArrayBuffer`\&gt;
