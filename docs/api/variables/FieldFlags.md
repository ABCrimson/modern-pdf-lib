[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldFlags

# Variable: FieldFlags

> `const` **FieldFlags**: `object`

Defined in: [src/form/pdfField.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/form/pdfField.ts#L55)

Common field flags (/Ff) — bit positions (0-indexed).

## Type Declaration

### Combo

> `readonly` **Combo**: `number`

Bit 17: The field is a combo box (dropdown).

### DoNotScroll

> `readonly` **DoNotScroll**: `number`

Bit 20: The field shall not scroll.

### Edit

> `readonly` **Edit**: `number`

Bit 18: The combo box includes an editable text field.

### Multiline

> `readonly` **Multiline**: `number`

Bit 12: The field may contain multiple lines.

### MultiSelect

> `readonly` **MultiSelect**: `number`

Bit 21: More than one item may be selected.

### NoExport

> `readonly` **NoExport**: `number`

Bit 2: The field shall not be exported.

### NoToggleToOff

> `readonly` **NoToggleToOff**: `number`

Bit 14: No toggle to off (for radio buttons).

### Password

> `readonly` **Password**: `number`

Bit 13: The field is intended for entering a password.

### Pushbutton

> `readonly` **Pushbutton**: `number`

Bit 16: The field is a pushbutton.

### Radio

> `readonly` **Radio**: `number`

Bit 15: The field is a set of radio buttons.

### RadiosInUnison

> `readonly` **RadiosInUnison**: `number`

Bit 25: If set, exactly one radio button shall be selected.

### ReadOnly

> `readonly` **ReadOnly**: `number`

Bit 0: The user may not change the value of the field.

### Required

> `readonly` **Required**: `number`

Bit 1: The field must have a value at export time.

### RichText

> `readonly` **RichText**: `number`

Bit 23: The value is a rich text string.

### Sort

> `readonly` **Sort**: `number`

Bit 19: Options shall be sorted alphabetically.
