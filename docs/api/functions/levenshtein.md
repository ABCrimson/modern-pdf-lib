[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / levenshtein

# Function: levenshtein()

```ts
function levenshtein(a, b): number;
```

Defined in: [src/utils/codeframe.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/utils/codeframe.ts#L90)

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
