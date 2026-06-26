[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RangeFetcher

# Interface: RangeFetcher

Defined in: src/runtime/rangeFetch.ts:52

A lazy, range-aware reader over a single remote resource.

## Methods

### fetchRange()

> **fetchRange**(`start`, `end`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: src/runtime/rangeFetch.ts:60

Fetch the half-open... actually inclusive byte range `[start, end]`.

#### Parameters

##### start

`number`

First byte offset (inclusive, >= 0).

##### end

`number`

Last byte offset (inclusive, >= start).

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The requested bytes as a Uint8Array.

***

### getLength()

> **getLength**(): `Promise`\<`number`\>

Defined in: src/runtime/rangeFetch.ts:65

Resolve the total length of the resource in bytes. The result is
cached after the first successful probe.

#### Returns

`Promise`\<`number`\>

***

### supportsRanges()

> **supportsRanges**(): `Promise`\<`boolean`\>

Defined in: src/runtime/rangeFetch.ts:70

Determine whether the server supports byte-range requests. The
result is cached after the first probe.

#### Returns

`Promise`\<`boolean`\>
