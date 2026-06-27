[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AFNumber\_Format

# Function: AFNumber\_Format()

```ts
function AFNumber_Format(
   nDec, 
   sepStyle, 
   negStyle, 
   currStyle, 
   strCurrency, 
   bCurrencyPrepend): (value) => string;
```

Defined in: [src/form/acrobatBuiltins.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/acrobatBuiltins.ts#L241)

Create an Acrobat-compatible number formatting function.

Returns a function that takes a raw value string and returns the
formatted display string.

## Parameters

### nDec

`number`

Number of decimal places.

### sepStyle

`number`

Separator style (0–3). See table above.

### negStyle

`number`

Negative style: 0=minus, 1=red (treated as minus),
                         2=parens, 3=red+parens (treated as parens).

### currStyle

`number`

Currency style (legacy, not used).

### strCurrency

`string`

Currency symbol string.

### bCurrencyPrepend

`boolean`

`true` to prepend the currency symbol.

## Returns

A formatting function `(value: string) => string`.

(`value`) =&gt; `string`
