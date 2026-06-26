[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WidthEntry

# Type Alias: WidthEntry

```ts
type WidthEntry = 
  | {
  kind: "individual";
  start: number;
  widths: readonly number[];
}
  | {
  first: number;
  kind: "range";
  last: number;
  width: number;
};
```

Defined in: [src/assets/font/fontEmbed.ts:498](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontEmbed.ts#L498)

An entry in the CIDFont /W array.

Format 1: `{ start, widths }` — individual widths for consecutive CIDs.
Format 2: `{ first, last, width }` — range with uniform width.
