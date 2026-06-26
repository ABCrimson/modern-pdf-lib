[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RangeFetchOptions

# Interface: RangeFetchOptions

Defined in: [src/runtime/rangeFetch.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L76)

Options for [createRangeFetcher](../functions/createRangeFetcher.md).

## Properties

### fetchImpl?

```ts
readonly optional fetchImpl?: FetchLike;
```

Defined in: [src/runtime/rangeFetch.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L81)

Transport used to issue requests. Defaults to `globalThis.fetch`
bound to the global object.
