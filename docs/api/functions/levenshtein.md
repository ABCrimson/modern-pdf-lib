[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / levenshtein

# Function: levenshtein()

```ts
function levenshtein(a, b): number;
```

Defined in: [src/utils/codeframe.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/codeframe.ts#L90)

Compute the Levenshtein edit distance between two strings: the minimum
number of single-character insertions, deletions, or substitutions required
to transform `a` into `b`.

## Parameters

### a

`string`

The first string.

### b

`string`

The second string.

## Returns

`number`

The edit distance (`>= 0`).
