[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LinearizationInfo

# Interface: LinearizationInfo

Defined in: [src/core/linearization.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L52)

Information extracted from a linearization parameter dictionary.
Maps to the entries defined in PDF spec §F.2.

## Properties

### firstPageOffset

```ts
firstPageOffset: number;
```

Defined in: [src/core/linearization.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L62)

Byte offset of the end of the first page section (/E).

***

### length

```ts
length: number;
```

Defined in: [src/core/linearization.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L56)

File length (/L).

***

### pageCount

```ts
pageCount: number;
```

Defined in: [src/core/linearization.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L60)

Total page count (/N).

***

### primaryPage

```ts
primaryPage: number;
```

Defined in: [src/core/linearization.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L58)

Object number of the first page's page object (/O).

***

### version

```ts
version: number;
```

Defined in: [src/core/linearization.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/linearization.ts#L54)

Linearization version (e.g. 1.0).
