[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RangeFetcher

# Interface: RangeFetcher

Defined in: [src/runtime/rangeFetch.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L52)

A lazy, range-aware reader over a single remote resource.

## Methods

### fetchRange()

```ts
fetchRange(start, end): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/runtime/rangeFetch.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L60)

Fetch the half-open... actually inclusive byte range `[start, end]`.

#### Parameters

##### start

`number`

First byte offset (inclusive, &gt;= 0).

##### end

`number`

Last byte offset (inclusive, &gt;= start).

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The requested bytes as a Uint8Array.

***

### getLength()

```ts
getLength(): Promise<number>;
```

Defined in: [src/runtime/rangeFetch.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L65)

Resolve the total length of the resource in bytes. The result is
cached after the first successful probe.

#### Returns

`Promise`\&lt;`number`\&gt;

***

### supportsRanges()

```ts
supportsRanges(): Promise<boolean>;
```

Defined in: [src/runtime/rangeFetch.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/rangeFetch.ts#L70)

Determine whether the server supports byte-range requests. The
result is cached after the first probe.

#### Returns

`Promise`\&lt;`boolean`\&gt;
