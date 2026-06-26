[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FetchLike

# Type Alias: FetchLike

> **FetchLike** = (`url`, `init?`) => `Promise`\<[`FetchLikeResponse`](../interfaces/FetchLikeResponse.md)\>

Defined in: src/runtime/rangeFetch.ts:44

The injectable transport. Compatible with the global `fetch` function
for the subset of features the range fetcher relies on.

## Parameters

### url

`string`

### init?

#### headers?

`Record`\<`string`, `string`\>

## Returns

`Promise`\<[`FetchLikeResponse`](../interfaces/FetchLikeResponse.md)\>
