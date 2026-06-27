[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findHyphenationPoints

# Function: findHyphenationPoints()

```ts
function findHyphenationPoints(word, _locale?): number[];
```

Defined in: [src/layout/textLayout.ts:215](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/textLayout.ts#L215)

Find possible hyphenation points for a word.
Returns an array of split positions (character indices where a hyphen
could be inserted *before* the character at that index).

## Parameters

### word

`string`

### \_locale?

`string`

## Returns

`number`[]
