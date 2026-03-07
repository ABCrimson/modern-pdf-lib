---
title: Table Layout
---

# Table Layout Engine

modern-pdf-lib includes a powerful table layout engine for creating data tables, invoices, reports, and schedules directly in PDF.

## Quick Start

```typescript
import { createPdf, PageSizes, rgb, renderTable } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawTable({
  x: 50,
  y: 750,
  width: 495,
  fontName: 'Helvetica',
  fontSize: 11,
  rows: [
    { cells: ['Product', 'Qty', 'Price', 'Total'], backgroundColor: { type: 'grayscale', gray: 0.9 } },
    { cells: ['Widget A', '10', '$5.00', '$50.00'] },
    { cells: ['Widget B', '25', '$3.50', '$87.50'] },
    { cells: ['Widget C', '5', '$12.00', '$60.00'] },
  ],
});

const bytes = await doc.save();
```

## Table Options

| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | required | Left edge X coordinate |
| `y` | `number` | required | Top edge Y coordinate |
| `width` | `number` | required | Total table width |
| `rows` | `TableRow[]` | required | Array of row definitions |
| `columns` | `TableColumn[]` | auto | Column width definitions |
| `fontName` | `string` | `'Helvetica'` | Font name |
| `fontSize` | `number` | `12` | Default font size |
| `textColor` | `Color` | black | Default text color |
| `borderColor` | `Color` | black | Border color |
| `borderWidth` | `number` | `0.5` | Border line width |
| `headerRows` | `number` | `0` | Rows repeated on page breaks |
| `padding` | `number` | `4` | Default cell padding |

## Cell Options

Cells can be simple strings or objects with styling:

```typescript
// Simple string cell
{ cells: ['Name', 'Age', 'City'] }

// Styled cell objects
{
  cells: [
    { content: 'Total', align: 'right', fontSize: 14 },
    { content: '$197.50', textColor: { type: 'rgb', red: 0, green: 0.5, blue: 0 } },
  ]
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | `''` | Cell text content |
| `colSpan` | `number` | `1` | Columns to span |
| `rowSpan` | `number` | `1` | Rows to span |
| `backgroundColor` | `Color` | none | Cell background color |
| `textColor` | `Color` | inherited | Text color |
| `fontSize` | `number` | inherited | Font size |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Horizontal alignment |
| `verticalAlign` | `'top' \| 'middle' \| 'bottom'` | `'top'` | Vertical alignment |
| `padding` | `number \| object` | inherited | Cell padding |

## Column Definitions

```typescript
page.drawTable({
  // ...
  columns: [
    { width: 200 },            // Fixed 200pt
    { width: 100 },            // Fixed 100pt
    {},                        // Flex (takes remaining space)
    { width: 80, align: 'right' }, // Fixed 80pt, right-aligned
  ],
});
```

## Examples

### Invoice Table

```typescript
const page = doc.addPage(PageSizes.A4);

// Header
page.drawText('INVOICE #2026-042', { x: 50, y: 780, size: 24 });
page.drawText('March 7, 2026', { x: 50, y: 755, size: 12 });

// Table
const result = page.drawTable({
  x: 50,
  y: 720,
  width: 495,
  fontName: 'Helvetica',
  fontSize: 10,
  borderWidth: 0.5,
  padding: 6,
  columns: [
    { width: 40, align: 'center' },   // #
    { width: 200 },                     // Description
    { width: 60, align: 'center' },    // Qty
    { width: 80, align: 'right' },     // Unit Price
    { width: 80, align: 'right' },     // Amount
  ],
  rows: [
    {
      cells: [
        { content: '#', align: 'center' },
        'Description',
        { content: 'Qty', align: 'center' },
        { content: 'Unit Price', align: 'right' },
        { content: 'Amount', align: 'right' },
      ],
      backgroundColor: { type: 'rgb', red: 0.2, green: 0.3, blue: 0.5 },
    },
    { cells: ['1', 'Web Development Services', '40', '$150.00', '$6,000.00'] },
    { cells: ['2', 'UI/UX Design', '20', '$120.00', '$2,400.00'] },
    { cells: ['3', 'Server Setup & Configuration', '8', '$200.00', '$1,600.00'] },
    { cells: ['4', 'SSL Certificate (Annual)', '1', '$99.00', '$99.00'] },
    {
      cells: [
        '', '', '',
        { content: 'Subtotal:', align: 'right', fontSize: 11 },
        { content: '$10,099.00', align: 'right', fontSize: 11 },
      ],
    },
    {
      cells: [
        '', '', '',
        { content: 'Tax (8%):', align: 'right' },
        { content: '$807.92', align: 'right' },
      ],
    },
    {
      cells: [
        '', '', '',
        { content: 'TOTAL:', align: 'right', fontSize: 14 },
        { content: '$10,906.92', align: 'right', fontSize: 14, textColor: { type: 'rgb', red: 0, green: 0.4, blue: 0 } },
      ],
      backgroundColor: { type: 'grayscale', gray: 0.95 },
    },
  ],
});
```

### Financial Report

```typescript
const result = page.drawTable({
  x: 50,
  y: 700,
  width: 500,
  fontName: 'Courier',
  fontSize: 9,
  padding: 5,
  rows: [
    {
      cells: ['Quarter', 'Revenue', 'Expenses', 'Profit', 'Margin'],
      backgroundColor: { type: 'grayscale', gray: 0.85 },
    },
    { cells: ['Q1 2025', '$2,450,000', '$1,890,000', '$560,000', '22.9%'] },
    { cells: ['Q2 2025', '$2,780,000', '$2,010,000', '$770,000', '27.7%'] },
    { cells: ['Q3 2025', '$3,120,000', '$2,250,000', '$870,000', '27.9%'] },
    { cells: ['Q4 2025', '$3,540,000', '$2,480,000', '$1,060,000', '29.9%'] },
    {
      cells: [
        { content: 'Total', fontSize: 10 },
        { content: '$11,890,000', fontSize: 10 },
        { content: '$8,630,000', fontSize: 10 },
        { content: '$3,260,000', fontSize: 10 },
        { content: '27.4%', fontSize: 10 },
      ],
      backgroundColor: { type: 'grayscale', gray: 0.9 },
    },
  ],
});
```

### Weekly Schedule

```typescript
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const times = ['9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00'];

const result = page.drawTable({
  x: 50,
  y: 700,
  width: 500,
  fontSize: 9,
  padding: 4,
  columns: [
    { width: 50 },
    ...days.map(() => ({})),
  ],
  rows: [
    {
      cells: ['Time', ...days],
      backgroundColor: { type: 'rgb', red: 0.2, green: 0.4, blue: 0.6 },
    },
    ...times.map(time => ({
      cells: [time, '', '', '', '', ''],
    })),
  ],
});
```

## Render Result

`drawTable()` returns a `TableRenderResult`:

```typescript
interface TableRenderResult {
  width: number;           // Total rendered width
  height: number;          // Total rendered height
  rowHeights: number[];    // Height of each row
  columnWidths: number[];  // Width of each column
  pagesUsed: number;       // Number of pages used
}
```

Use this to position content below the table:

```typescript
const result = page.drawTable({ x: 50, y: 700, ... });
const belowTable = 700 - result.height - 20; // 20pt gap
page.drawText('Notes:', { x: 50, y: belowTable, size: 12 });
```

## Styling Presets

Apply a preset for instant professional styling:

```typescript
import { professionalPreset, applyPreset } from 'modern-pdf-lib';

page.drawTable(applyPreset(professionalPreset(), {
  x: 50, y: 750, width: 495,
  headerRows: 1,
  rows: [
    { cells: ['Product', 'Qty', 'Price'] },
    { cells: ['Widget A', '10', '$5.00'] },
    { cells: ['Widget B', '25', '$3.50'] },
  ],
}));
```

| Preset | Description |
|---|---|
| `minimalPreset()` | Clean, borderless, subtle header |
| `stripedPreset()` | Alternating row colors, dark header |
| `borderedPreset()` | Full grid borders, dark header |
| `professionalPreset()` | Dark blue header, subtle stripes |

You can also use `applyTablePreset('professional', options)` by name.

## Alternating Row Colors

```typescript
page.drawTable({
  // ...
  alternateRowColors: [rgb(1, 1, 1), rgb(0.95, 0.95, 0.97)],
  headerBackgroundColor: rgb(0.16, 0.31, 0.52),
  headerTextColor: rgb(1, 1, 1),
  headerRows: 1,
});
```

## Styled Text Runs

Cells support rich text with per-segment font, size, and color:

```typescript
{
  cells: [
    {
      content: [
        { text: 'Bold Title ', fontSize: 14 },
        { text: '(subtitle)', fontSize: 10, color: grayscale(0.5) },
      ],
    },
    'Normal cell',
  ],
}
```

## Text Overflow

Control how text behaves when it exceeds cell width:

```typescript
{
  cells: [
    { content: 'Very long text...', overflow: 'wrap' },       // Word wrap (default)
    { content: 'Very long text...', overflow: 'truncate' },    // Hard cut
    { content: 'Very long text...', overflow: 'ellipsis' },    // Truncate with "..."
    { content: 'Very long text...', overflow: 'shrink' },      // Reduce font size
  ]
}
```

## Nested Tables

Embed a table inside a cell:

```typescript
{
  cells: [
    'Summary',
    {
      content: {
        type: 'table',
        table: {
          rows: [
            { cells: ['A', 'B'] },
            { cells: ['1', '2'] },
          ],
        },
      },
    },
  ],
}
```

## Multi-Page Tables

For tables that span multiple pages with automatic header repetition:

```typescript
import { renderMultiPageTable } from 'modern-pdf-lib';

const result = renderMultiPageTable({
  x: 50, y: 750, width: 495,
  headerRows: 1,
  fontName: 'Helvetica',
  fontSize: 10,
  rows: longDataRows,
}, 50); // bottom margin

// result.pages: { ops: string, pageIndex: number }[]
for (const pageContent of result.pages) {
  const page = doc.addPage(PageSizes.A4);
  page.pushOperators(pageContent.ops);
}
```

## Column Width Modes

```typescript
columns: [
  { width: 100 },               // Fixed: 100pt
  { percentage: '30%' },        // 30% of table width
  { flex: 2 },                  // Flex weight (2x share of remaining space)
  { flex: 1 },                  // Flex weight (1x share)
  { autoFit: true },            // Fit widest content
  { width: 80, minWidth: 50 },  // Fixed with floor
]
```

## Best Practices

1. **Use presets** for consistent, professional styling out of the box
2. **Set column widths explicitly** for predictable layouts
3. **Use `headerRows`** for multi-page tables (headers repeat automatically)
4. **Right-align numeric columns** with `columns: [{ align: 'right' }]`
5. **Use alternating backgrounds** for long tables to improve scannability
6. **Use `overflow: 'ellipsis'`** for columns with potentially long content
