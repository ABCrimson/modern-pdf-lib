/**
 * Generate a comprehensive showcase PDF that exercises every feature.
 * Run with: npx tsx scripts/gen-showcase-pdf.ts
 */
import { createPdf, PageSizes, rgb, degrees } from '../src/index.js';
import { readFile, writeFile } from 'node:fs/promises';

const pdf = createPdf();
pdf.setTitle('Modern PDF Engine — Feature Showcase');
pdf.setAuthor('modern-pdf v0.14.0');
pdf.setProducer('modern-pdf');
pdf.setCreator('gen-showcase-pdf.ts');
pdf.setCreationDate(new Date('2026-02-25T00:00:00Z'));

// Embed fonts
const helvetica = await pdf.embedFont('Helvetica');
const helveticaBold = await pdf.embedFont('Helvetica-Bold');
const courier = await pdf.embedFont('Courier');
const timesRoman = await pdf.embedFont('Times-Roman');
const timesBold = await pdf.embedFont('Times-Bold');

// Load test images
const pngRgb = await readFile('tests/fixtures/images/gradient-8x8.png');
const pngRgba = await readFile('tests/fixtures/images/sample-rgba.png');
const jpegData = await readFile('tests/fixtures/images/sample.jpg');

const pngImg = await pdf.embedPng(new Uint8Array(pngRgb));
const pngAlpha = await pdf.embedPng(new Uint8Array(pngRgba));
const jpgImg = await pdf.embedJpeg(new Uint8Array(jpegData));

// ─── PAGE 1: Text & Typography ──────────────────────────────────────────────
const p1 = pdf.addPage(PageSizes.A4);
const W = PageSizes.A4[0];

// Title
p1.drawText('Modern PDF Engine', {
  x: 50, y: 780, font: helveticaBold, size: 28, color: rgb(0.12, 0.12, 0.35),
});
p1.drawText('Feature Showcase', {
  x: 50, y: 748, font: helvetica, size: 16, color: rgb(0.4, 0.4, 0.5),
});
p1.drawLine({
  start: { x: 50, y: 738 }, end: { x: W - 50, y: 738 },
  thickness: 2, color: rgb(0.2, 0.4, 0.8),
});

// Section: Standard Fonts
let y = 710;
p1.drawText('1. Standard PDF Fonts', {
  x: 50, y, font: helveticaBold, size: 14, color: rgb(0, 0, 0),
});
y -= 24;

const fonts = [
  { name: 'Helvetica', ref: helvetica },
  { name: 'Helvetica-Bold', ref: helveticaBold },
  { name: 'Courier', ref: courier },
  { name: 'Times-Roman', ref: timesRoman },
  { name: 'Times-Bold', ref: timesBold },
];

for (const f of fonts) {
  p1.drawText(`${f.name}: The quick brown fox jumps over the lazy dog.`, {
    x: 70, y, font: f.ref, size: 10, color: rgb(0.15, 0.15, 0.15),
  });
  y -= 16;
}

// Section: Text Measurement
y -= 10;
p1.drawText('2. Text Measurement', {
  x: 50, y, font: helveticaBold, size: 14, color: rgb(0, 0, 0),
});
y -= 24;

const testStr = 'Hello, Modern PDF!';
const testSize = 18;
const textWidth = helvetica.widthOfTextAtSize(testStr, testSize);
const textHeight = helvetica.heightAtSize(testSize);

p1.drawText(testStr, {
  x: 70, y, font: helvetica, size: testSize, color: rgb(0, 0, 0.7),
});

// Draw a bounding box around the measured text
p1.drawRectangle({
  x: 70, y: y - (textHeight - testSize * 0.8),
  width: textWidth, height: textHeight,
  borderColor: rgb(1, 0, 0), borderWidth: 0.5,
});
y -= 20;

p1.drawText(
  `Measured: width = ${textWidth.toFixed(1)}pt, height = ${textHeight.toFixed(1)}pt`,
  { x: 70, y, font: courier, size: 9, color: rgb(0.3, 0.3, 0.3) },
);

// Section: Multi-line Text
y -= 30;
p1.drawText('3. Multi-line Text', {
  x: 50, y, font: helveticaBold, size: 14, color: rgb(0, 0, 0),
});
y -= 24;

p1.drawText(
  'Line 1: ESM-only, no CommonJS\nLine 2: Uint8Array everywhere, no Buffer\nLine 3: Async-first, streaming output\nLine 4: WASM-accelerated compression',
  { x: 70, y, font: helvetica, size: 10, color: rgb(0.2, 0.2, 0.2), lineHeight: 14 },
);

// Section: Rotated Text
y -= 80;
p1.drawText('4. Rotated Text', {
  x: 50, y, font: helveticaBold, size: 14, color: rgb(0, 0, 0),
});

p1.drawText('15 degrees', {
  x: 120, y: y - 30, font: helvetica, size: 12,
  color: rgb(0.6, 0, 0), rotate: degrees(15),
});
p1.drawText('-10 degrees', {
  x: 250, y: y - 30, font: helvetica, size: 12,
  color: rgb(0, 0, 0.6), rotate: degrees(-10),
});
p1.drawText('45 degrees', {
  x: 380, y: y - 10, font: helvetica, size: 12,
  color: rgb(0, 0.5, 0), rotate: degrees(45),
});

// Section: Opacity
y -= 80;
p1.drawText('5. Opacity', {
  x: 50, y, font: helveticaBold, size: 14, color: rgb(0, 0, 0),
});
y -= 20;

for (let i = 0; i < 5; i++) {
  const opacity = 1.0 - i * 0.2;
  p1.drawRectangle({
    x: 70 + i * 90, y: y - 30,
    width: 70, height: 40,
    color: rgb(0.2, 0.4, 0.9),
    opacity,
  });
  p1.drawText(`${(opacity * 100).toFixed(0)}%`, {
    x: 90 + i * 90, y: y - 18,
    font: helvetica, size: 10, color: rgb(1, 1, 1), opacity,
  });
}

// ─── PAGE 2: Shapes & Graphics ──────────────────────────────────────────────
const p2 = pdf.addPage(PageSizes.A4);

p2.drawText('Shapes & Graphics', {
  x: 50, y: 780, font: helveticaBold, size: 22, color: rgb(0.12, 0.12, 0.35),
});
p2.drawLine({
  start: { x: 50, y: 770 }, end: { x: W - 50, y: 770 },
  thickness: 2, color: rgb(0.2, 0.4, 0.8),
});

// Rectangles
p2.drawText('Rectangles', {
  x: 50, y: 740, font: helveticaBold, size: 13, color: rgb(0, 0, 0),
});

// Filled
p2.drawRectangle({ x: 70, y: 680, width: 100, height: 40, color: rgb(0.2, 0.6, 0.9) });
p2.drawText('Filled', { x: 95, y: 695, font: helvetica, size: 9, color: rgb(1, 1, 1) });

// Stroked
p2.drawRectangle({
  x: 190, y: 680, width: 100, height: 40,
  borderColor: rgb(0.8, 0.2, 0.2), borderWidth: 2,
});
p2.drawText('Stroked', { x: 215, y: 695, font: helvetica, size: 9, color: rgb(0, 0, 0) });

// Fill + Stroke
p2.drawRectangle({
  x: 310, y: 680, width: 100, height: 40,
  color: rgb(0.95, 0.95, 0.3), borderColor: rgb(0, 0.5, 0), borderWidth: 2,
});
p2.drawText('Both', { x: 340, y: 695, font: helvetica, size: 9, color: rgb(0, 0, 0) });

// Lines
p2.drawText('Lines', {
  x: 50, y: 660, font: helveticaBold, size: 13, color: rgb(0, 0, 0),
});

p2.drawLine({ start: { x: 70, y: 640 }, end: { x: 500, y: 640 }, thickness: 1, color: rgb(0, 0, 0) });
p2.drawLine({ start: { x: 70, y: 628 }, end: { x: 500, y: 628 }, thickness: 2, color: rgb(0.8, 0, 0), dashArray: [8, 4] });
p2.drawLine({ start: { x: 70, y: 614 }, end: { x: 500, y: 614 }, thickness: 3, color: rgb(0, 0, 0.8), dashArray: [2, 6] });
p2.drawLine({ start: { x: 70, y: 598 }, end: { x: 500, y: 598 }, thickness: 1.5, color: rgb(0, 0.6, 0), dashArray: [12, 3, 3, 3] });

// Circles
p2.drawText('Circles', {
  x: 50, y: 570, font: helveticaBold, size: 13, color: rgb(0, 0, 0),
});

p2.drawCircle({ x: 120, y: 510, radius: 40, color: rgb(0.9, 0.3, 0.3) });
p2.drawCircle({ x: 230, y: 510, radius: 40, borderColor: rgb(0, 0.6, 0), borderWidth: 3 });
p2.drawCircle({
  x: 340, y: 510, radius: 40,
  color: rgb(0.3, 0.3, 0.9), borderColor: rgb(0, 0, 0), borderWidth: 2,
});
p2.drawCircle({ x: 450, y: 510, radius: 40, color: rgb(0.9, 0.7, 0.1), opacity: 0.6 });

// Ellipses
p2.drawText('Ellipses', {
  x: 50, y: 450, font: helveticaBold, size: 13, color: rgb(0, 0, 0),
});

p2.drawEllipse({ x: 140, y: 400, xScale: 70, yScale: 30, color: rgb(0.5, 0.2, 0.8) });
p2.drawEllipse({
  x: 330, y: 400, xScale: 80, yScale: 35,
  borderColor: rgb(0.8, 0.5, 0), borderWidth: 2,
});

// Color grid
p2.drawText('Color Gradient', {
  x: 50, y: 340, font: helveticaBold, size: 13, color: rgb(0, 0, 0),
});

for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 10; col++) {
    p2.drawRectangle({
      x: 70 + col * 45, y: 280 - row * 35,
      width: 38, height: 28,
      color: rgb(col / 9, row / 3, 0.5),
    });
  }
}

// Graphics state demo
p2.drawText('Graphics State (push/pop)', {
  x: 50, y: 140, font: helveticaBold, size: 13, color: rgb(0, 0, 0),
});

p2.pushGraphicsState();
p2.setTransform(
  Math.cos(0.1), Math.sin(0.1),
  -Math.sin(0.1), Math.cos(0.1),
  100, -10,
);
p2.drawRectangle({ x: 70, y: 80, width: 150, height: 40, color: rgb(0.2, 0.7, 0.3) });
p2.drawText('Slightly rotated', { x: 85, y: 95, font: helvetica, size: 10, color: rgb(1, 1, 1) });
p2.popGraphicsState();

p2.drawRectangle({ x: 350, y: 80, width: 150, height: 40, color: rgb(0.7, 0.2, 0.3) });
p2.drawText('Not rotated', { x: 380, y: 95, font: helvetica, size: 10, color: rgb(1, 1, 1) });

// ─── PAGE 3: Images ─────────────────────────────────────────────────────────
const p3 = pdf.addPage(PageSizes.A4);

p3.drawText('Images', {
  x: 50, y: 780, font: helveticaBold, size: 22, color: rgb(0.12, 0.12, 0.35),
});
p3.drawLine({
  start: { x: 50, y: 770 }, end: { x: W - 50, y: 770 },
  thickness: 2, color: rgb(0.2, 0.4, 0.8),
});

// PNG RGB
p3.drawText('PNG RGB (8x8 gradient, scaled)', {
  x: 50, y: 740, font: helveticaBold, size: 12, color: rgb(0, 0, 0),
});
p3.drawImage(pngImg, { x: 70, y: 580, width: 150, height: 150 });

// Add border around the image for visibility
p3.drawRectangle({
  x: 70, y: 580, width: 150, height: 150,
  borderColor: rgb(0, 0, 0), borderWidth: 1,
});

// PNG RGBA
p3.drawText('PNG RGBA (4x4 with alpha, scaled)', {
  x: 280, y: 740, font: helveticaBold, size: 12, color: rgb(0, 0, 0),
});
p3.drawImage(pngAlpha, { x: 300, y: 580, width: 150, height: 150 });
p3.drawRectangle({
  x: 300, y: 580, width: 150, height: 150,
  borderColor: rgb(0, 0, 0), borderWidth: 1,
});

// JPEG
p3.drawText('JPEG (1x1 grayscale, scaled)', {
  x: 50, y: 560, font: helveticaBold, size: 12, color: rgb(0, 0, 0),
});
p3.drawImage(jpgImg, { x: 70, y: 400, width: 150, height: 150 });
p3.drawRectangle({
  x: 70, y: 400, width: 150, height: 150,
  borderColor: rgb(0, 0, 0), borderWidth: 1,
});

// Image info
p3.drawText('Image Metadata:', {
  x: 50, y: 370, font: helveticaBold, size: 12, color: rgb(0, 0, 0),
});
p3.drawText(
  `PNG RGB: ${pngImg.width}x${pngImg.height}  |  PNG RGBA: ${pngAlpha.width}x${pngAlpha.height}  |  JPEG: ${jpgImg.width}x${jpgImg.height}`,
  { x: 70, y: 352, font: courier, size: 9, color: rgb(0.3, 0.3, 0.3) },
);

// ─── Save all formats ────────────────────────────────────────────────────────
const bytes = await pdf.save();
const bytesUncompressed = await pdf.save({ compress: false });

await writeFile('showcase.pdf', bytes);
await writeFile('showcase-uncompressed.pdf', bytesUncompressed);

console.log(`Showcase PDF generated:`);
console.log(`  Compressed:   ${bytes.length.toLocaleString()} bytes (${(bytes.length / 1024).toFixed(1)} KB)`);
console.log(`  Uncompressed: ${bytesUncompressed.length.toLocaleString()} bytes (${(bytesUncompressed.length / 1024).toFixed(1)} KB)`);
console.log(`  Compression:  ${((1 - bytes.length / bytesUncompressed.length) * 100).toFixed(1)}% reduction`);
console.log(`  Pages:        ${pdf.getPageCount()}`);
console.log(`  Fonts:        ${fonts.length}`);
console.log(`  Images:       3 (PNG RGB, PNG RGBA, JPEG)`);
