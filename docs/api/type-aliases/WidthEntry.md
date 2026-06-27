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

Defined in: [src/assets/font/fontEmbed.ts:498](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/font/fontEmbed.ts#L498)

An entry in the CIDFont /W array.

Format 1: `{ start, widths }` — individual widths for consecutive CIDs.
Format 2: `{ first, last, width }` — range with uniform width.
