/**
 * @module cli/optimize
 *
 * CLI command: `modern-pdf optimize input.pdf output.pdf [options]`
 *
 * Optimizes images in a PDF file by recompressing them as JPEG,
 * with optional deduplication and grayscale detection.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type { ChromaSubsampling } from '../wasm/jpeg/bridge.js';

/**
 * Parse and execute the optimize command.
 */
export async function optimizeCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printOptimizeHelp();
    return;
  }

  if (!parsed.input || !parsed.output) {
    console.error('Error: input and output file paths are required.');
    console.error('Usage: modern-pdf optimize <input.pdf> <output.pdf> [options]');
    process.exit(1);
  }

  // Dynamic import to avoid loading the library at module scope
  const { loadPdf } = await import('../index.js');
  const { initJpegWasm } = await import('../wasm/jpeg/bridge.js');
  const { optimizeAllImages } = await import(
    '../assets/image/batchOptimize.js'
  );
  const { deduplicateImages } = await import(
    '../assets/image/deduplicateImages.js'
  );

  // Read input PDF
  const inputBytes = new Uint8Array(await readFile(parsed.input));
  const inputSize = inputBytes.length;

  if (parsed.verbose) {
    console.log(`Input:  ${parsed.input} (${formatBytes(inputSize)})`);
    console.log(`Output: ${parsed.output}`);
    console.log('');
  }

  // Initialize JPEG WASM
  try {
    await initJpegWasm();
  } catch {
    console.warn(
      'Warning: JPEG WASM module not available. ' +
        'Images will not be recompressed.',
    );
  }

  // Parse PDF
  const doc = await loadPdf(inputBytes);

  // Deduplicate first (if requested)
  if (parsed.dedup) {
    const dedupReport = deduplicateImages(doc);
    if (parsed.verbose && dedupReport.duplicatesRemoved > 0) {
      console.log(
        `Deduplication: removed ${dedupReport.duplicatesRemoved} duplicate(s), ` +
          `~${formatBytes(dedupReport.bytesSaved)} saved`,
      );
    }
  }

  // Optimize images
  const report = await optimizeAllImages(doc, {
    quality: parsed.quality,
    progressive: parsed.progressive,
    chromaSubsampling: parsed.chroma,
    autoGrayscale: parsed.grayscale,
    skipSmallImages: true,
    minSavingsPercent: 10,
  });

  if (parsed.verbose) {
    console.log('');
    console.log(`Images found:     ${report.totalImages}`);
    console.log(`Images optimized: ${report.optimizedImages}`);
    console.log(
      `Original size:    ${formatBytes(report.originalTotalBytes)}`,
    );
    console.log(
      `Optimized size:   ${formatBytes(report.optimizedTotalBytes)}`,
    );
    console.log(`Savings:          ${report.savings.toFixed(1)}%`);

    if (report.perImage.length > 0) {
      console.log('');
      console.log('Per-image details:');
      for (const entry of report.perImage) {
        if (entry.skipped) {
          console.log(
            `  ${entry.name} (p${entry.pageIndex}): SKIP — ${entry.reason}`,
          );
        } else {
          const pct = (
            ((entry.originalSize - entry.newSize) / entry.originalSize) *
            100
          ).toFixed(1);
          console.log(
            `  ${entry.name} (p${entry.pageIndex}): ` +
              `${formatBytes(entry.originalSize)} → ${formatBytes(entry.newSize)} (−${pct}%)`,
          );
        }
      }
    }
  }

  // Save output
  const outputBytes = await doc.save();
  await writeFile(parsed.output, outputBytes);

  const outputSize = outputBytes.length;
  const totalSavings =
    inputSize > 0
      ? (((inputSize - outputSize) / inputSize) * 100).toFixed(1)
      : '0.0';

  console.log(
    `\n${formatBytes(inputSize)} → ${formatBytes(outputSize)} (−${totalSavings}%)`,
  );
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  input?: string;
  output?: string;
  quality: number;
  progressive: boolean;
  grayscale: boolean;
  dedup: boolean;
  chroma: ChromaSubsampling;
  verbose: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    quality: 80,
    progressive: false,
    grayscale: false,
    dedup: false,
    chroma: '4:2:0',
    verbose: false,
    help: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        return result;

      case '--quality':
      case '-q':
        result.quality = parseInt(args[++i] ?? '80', 10);
        if (result.quality < 1 || result.quality > 100) {
          console.error('Error: --quality must be between 1 and 100.');
          process.exit(1);
        }
        break;

      case '--max-dpi':
        // Consumed but not yet used in this version
        i++;
        break;

      case '--progressive':
        result.progressive = true;
        break;

      case '--grayscale':
        result.grayscale = true;
        break;

      case '--dedup':
        result.dedup = true;
        break;

      case '--chroma': {
        const val = args[++i] ?? '4:2:0';
        if (val !== '4:4:4' && val !== '4:2:2' && val !== '4:2:0') {
          console.error('Error: --chroma must be 4:4:4, 4:2:2, or 4:2:0.');
          process.exit(1);
        }
        result.chroma = val as ChromaSubsampling;
        break;
      }

      case '--verbose':
      case '-v':
        result.verbose = true;
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional[0] !== undefined) result.input = positional[0];
  if (positional[1] !== undefined) result.output = positional[1];

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printOptimizeHelp(): void {
  console.log(`
modern-pdf optimize — Optimize images in a PDF file

Usage:
  modern-pdf optimize <input.pdf> <output.pdf> [options]

Options:
  --quality <n>, -q <n>   JPEG quality 1-100 (default: 80)
  --progressive           Use progressive JPEG encoding
  --grayscale             Auto-detect and convert grayscale images
  --dedup                 Deduplicate identical images
  --chroma <mode>         Chroma subsampling: 4:4:4, 4:2:2, 4:2:0 (default: 4:2:0)
  --verbose, -v           Print per-image optimization details
  --help, -h              Show this help

Examples:
  modern-pdf optimize report.pdf report-opt.pdf
  modern-pdf optimize scan.pdf scan-opt.pdf --quality 60 --grayscale --dedup -v
`.trim());
}
