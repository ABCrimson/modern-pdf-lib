[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / didYouMean

# Function: didYouMean()

```ts
function didYouMean(
   input, 
   candidates, 
   maxDistance?): string | undefined;
```

Defined in: [src/utils/codeframe.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/utils/codeframe.ts#L143)

Suggest the closest candidate to `input` from a list of `candidates`,
useful for "did you mean …?" hints.

The accepted distance is the smaller of `maxDistance` and a value scaled to
the length of `input` (roughly one third of its length, with a minimum of
one), so short identifiers do not match wildly different strings.

## Parameters

### input

`string`

The (possibly misspelled) string.

### candidates

readonly `string`[]

The known valid strings.

### maxDistance?

`number` = `3`

The hard upper bound on edit distance. Defaults to `3`.

## Returns

`string` \| `undefined`

The closest candidate within range, or `undefined`.
