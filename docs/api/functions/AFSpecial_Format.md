[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AFSpecial\_Format

# Function: AFSpecial\_Format()

```ts
function AFSpecial_Format(psf): (value) => string;
```

Defined in: [src/form/acrobatSpecialBuiltins.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/acrobatSpecialBuiltins.ts#L161)

Create a special field formatter matching Acrobat's `AFSpecial_Format`.

| psf | Format             | Example       |
| --- | ------------------ | ------------- |
| 0   | ZIP Code           | 12345         |
| 1   | ZIP+4              | 12345-6789    |
| 2   | Phone              | (123) 456-7890 |
| 3   | SSN                | 123-45-6789   |

## Parameters

### psf

`number`

The predefined special format type (0–3).

## Returns

A function that formats a digit string using the special mask.

(`value`) =&gt; `string`
