/**
 * Generate a reference "Hello, World!" PDF for testing.
 *
 * Run with: npx tsx scripts/gen-reference-pdf.ts
 *
 * The PDF contains:
 * - An A4 page
 * - "Hello, World!" in Helvetica 24pt
 * - A red line underneath
 * - Document title set to "Hello World Reference"
 *
 * Output: tests/fixtures/expected/hello-world.pdf
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPdf, PageSizes, StandardFonts, rgb } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = resolve(__dirname, '../tests/fixtures/expected');
const outputPath = resolve(outputDir, 'hello-world.pdf');

async function main(): Promise<void> {
  const doc = createPdf();

  // Set document metadata
  doc.setTitle('Hello World Reference');
  doc.setAuthor('modern-pdf');
  doc.setCreator('gen-reference-pdf.ts');
  doc.setProducer('modern-pdf');
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));

  // Create an A4 page
  const page = doc.addPage(PageSizes.A4);

  // Embed Helvetica font
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Draw "Hello, World!" in Helvetica 24pt
  const text = 'Hello, World!';
  const fontSize = 24;
  const textX = 50;
  const textY = 750;

  page.drawText(text, {
    x: textX,
    y: textY,
    font,
    size: fontSize,
    color: rgb(0, 0, 0),
  });

  // Draw a red line underneath the text
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  page.drawLine({
    start: { x: textX, y: textY - 5 },
    end: { x: textX + textWidth, y: textY - 5 },
    color: rgb(1, 0, 0),
    thickness: 2,
  });

  // Save the PDF (uncompressed for easy inspection)
  const bytes = await doc.save({ compress: false });

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Write the file
  await writeFile(outputPath, bytes);

  console.log(`Reference PDF written to: ${outputPath}`);
  console.log(`Size: ${bytes.length} bytes`);
}

main().catch((err) => {
  console.error('Failed to generate reference PDF:', err);
  process.exit(1);
});
