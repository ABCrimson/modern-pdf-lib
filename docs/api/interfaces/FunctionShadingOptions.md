[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FunctionShadingOptions

# Interface: FunctionShadingOptions

Defined in: src/core/shadingFunction.ts:35

Options describing a function-based (type 1) shading.

## Properties

### colorSpace?

> `readonly` `optional` **colorSpace?**: `string`

Defined in: src/core/shadingFunction.ts:52

The shading colour space name (e.g. `DeviceRGB`, `DeviceGray`,
`DeviceCMYK`). Defaults to `DeviceRGB`.

***

### domain?

> `readonly` `optional` **domain?**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: src/core/shadingFunction.ts:40

The rectangular domain `[xmin xmax ymin ymax]` of the shading's
coordinate space. Defaults to `[0 1 0 1]` per the spec.

***

### fn

> `readonly` **fn**: [`PdfFunctionDef`](../type-aliases/PdfFunctionDef.md)

Defined in: src/core/shadingFunction.ts:57

The colour-producing function. Its input is the 2-D domain coordinate and
its output is one colour value in [FunctionShadingOptions.colorSpace](#colorspace).

***

### matrix?

> `readonly` `optional` **matrix?**: readonly \[`number`, `number`, `number`, `number`, `number`, `number`\]

Defined in: src/core/shadingFunction.ts:45

The `/Matrix` mapping the domain into the target (pattern/user) space,
as `[a b c d e f]`. Defaults to the identity matrix.
