[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FetchLike

# Type Alias: FetchLike

```ts
type FetchLike = (url, init?) => Promise<FetchLikeResponse>;
```

Defined in: [src/runtime/rangeFetch.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/rangeFetch.ts#L44)

The injectable transport. Compatible with the global `fetch` function
for the subset of features the range fetcher relies on.

## Parameters

### url

`string`

### init?

#### headers?

`Record`\&lt;`string`, `string`\&gt;

## Returns

`Promise`\&lt;[`FetchLikeResponse`](../interfaces/FetchLikeResponse.md)\&gt;
