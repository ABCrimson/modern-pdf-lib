[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RangeFetchOptions

# Interface: RangeFetchOptions

Defined in: [src/runtime/rangeFetch.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L76)

Options for [createRangeFetcher](../functions/createRangeFetcher.md).

## Properties

### fetchImpl?

```ts
readonly optional fetchImpl?: FetchLike;
```

Defined in: [src/runtime/rangeFetch.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L81)

Transport used to issue requests. Defaults to `globalThis.fetch`
bound to the global object.
