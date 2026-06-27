[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createRangeFetcher

# Function: createRangeFetcher()

```ts
function createRangeFetcher(url, options?): RangeFetcher;
```

Defined in: [src/runtime/rangeFetch.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L147)

Create a [RangeFetcher](../interfaces/RangeFetcher.md) for the given URL.

The returned fetcher is stateful: it lazily caches the resource length
and the range-support flag after the first successful probe.

## Parameters

### url

`string`

Absolute URL of the remote resource.

### options?

[`RangeFetchOptions`](../interfaces/RangeFetchOptions.md)

Optional [RangeFetchOptions](../interfaces/RangeFetchOptions.md).

## Returns

[`RangeFetcher`](../interfaces/RangeFetcher.md)

A [RangeFetcher](../interfaces/RangeFetcher.md).
