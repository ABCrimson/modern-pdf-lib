[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RangeFetchOptions

# Interface: RangeFetchOptions

Defined in: src/runtime/rangeFetch.ts:76

Options for [createRangeFetcher](../functions/createRangeFetcher.md).

## Properties

### fetchImpl?

> `readonly` `optional` **fetchImpl?**: [`FetchLike`](../type-aliases/FetchLike.md)

Defined in: src/runtime/rangeFetch.ts:81

Transport used to issue requests. Defaults to `globalThis.fetch`
bound to the global object.
