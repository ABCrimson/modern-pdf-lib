[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseAcrobatDate

# Function: parseAcrobatDate()

```ts
function parseAcrobatDate(text, format): Date | null;
```

Defined in: [src/form/acrobatDateBuiltins.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/acrobatDateBuiltins.ts#L258)

Parse a date string using an Acrobat-compatible format string.

Attempts to extract date components (year, month, day, hour, minute,
second) from the input text based on the format pattern.

## Parameters

### text

`string`

The date string to parse.

### format

`string`

The Acrobat format string.

## Returns

`Date` \| `null`

A `Date` object, or `null` if parsing fails.
