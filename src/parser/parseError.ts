/**
 * @module parser/parseError
 * Structured error class for PDF parsing failures.
 * @packageDocumentation
 */

export class PdfParseError extends Error {
  override readonly name = 'PdfParseError';
  readonly offset: number;
  readonly expected: string;
  readonly actual: string;
  readonly hexContext: string;

  constructor(options: {
    message: string;
    offset: number;
    expected?: string | undefined;
    actual?: string | undefined;
    data?: Uint8Array | undefined;
    cause?: Error | undefined;
  }) {
    // Build multi-line message with context
    const hexCtx = options.data ? formatHexContext(options.data, options.offset) : '';
    const parts = [options.message];
    if (options.expected) parts.push(`  Expected: ${options.expected}`);
    if (options.actual) parts.push(`  Got: ${options.actual}`);
    if (hexCtx) parts.push(`  Context:\n${hexCtx}`);

    super(parts.join('\n'), options.cause ? { cause: options.cause } : undefined);
    this.offset = options.offset;
    this.expected = options.expected ?? '';
    this.actual = options.actual ?? '';
    this.hexContext = hexCtx;
  }
}

export function formatHexContext(data: Uint8Array, offset: number, windowSize = 16): string {
  const start = Math.max(0, offset - windowSize);
  const end = Math.min(data.length, offset + windowSize);
  const slice = data.subarray(start, end);

  const hexParts: string[] = [];
  const asciiParts: string[] = [];

  for (let i = 0; i < slice.length; i++) {
    const byte = slice[i]!;
    const isErrorByte = (start + i) === offset;
    const hex = byte.toString(16).padStart(2, '0');
    hexParts.push(isErrorByte ? `[${hex}]` : ` ${hex} `);
    asciiParts.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
  }

  return [
    `    Offset ${start}:`,
    `    Hex:   ${hexParts.join('')}`,
    `    ASCII: ${asciiParts.join(' ')}`,
    `    Error at offset ${offset} (marked with [])`,
  ].join('\n');
}
