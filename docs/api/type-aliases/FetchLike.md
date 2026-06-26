[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FetchLike

# Type Alias: FetchLike

```ts
type FetchLike = (url, init?) => Promise<FetchLikeResponse>;
```

Defined in: [src/runtime/rangeFetch.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L44)

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
