import { createPdf, PdfDocument, loadPdf, rgb } from '../src/index.js';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  console.log('=== Round-trip Content Preservation Test ===\n');

  // Step 1: Create a PDF with real content
  const doc = createPdf();
  doc.setTitle('Round-trip Test');
  doc.setAuthor('modern-pdf');
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont('Helvetica');
  page.drawText('Hello, round-trip world!', { x: 50, y: 700, font, size: 24 });
  page.drawText('Second line of text.', { x: 50, y: 660, font, size: 16 });
  page.drawRectangle({ x: 50, y: 500, width: 200, height: 100, borderColor: rgb(1, 0, 0) });
  page.drawLine({ start: { x: 50, y: 480 }, end: { x: 250, y: 480 } });

  const originalBytes = await doc.save();
  console.log(`1. Created PDF: ${originalBytes.length} bytes`);

  // Step 2: Load the PDF
  const loaded = await loadPdf(originalBytes);
  console.log(`2. Loaded: pageCount=${loaded.pageCount}, title="${loaded.getTitle()}", author="${loaded.getAuthor()}"`);
  assert(loaded.pageCount === 1, 'Loaded page count should be 1');
  assert(loaded.getTitle() === 'Round-trip Test', 'Title should survive load');
  assert(loaded.getAuthor() === 'modern-pdf', 'Author should survive load');

  // Step 3: Save the loaded PDF (no modifications)
  const resavedBytes = await loaded.save();
  console.log(`3. Re-saved: ${resavedBytes.length} bytes`);

  // Verify the re-saved PDF is a valid PDF
  const header = new TextDecoder('ascii').decode(resavedBytes.subarray(0, 5));
  assert(header === '%PDF-', 'Re-saved should start with %PDF-');

  // Step 4: Re-load the re-saved PDF and verify structure
  const reloaded = await loadPdf(resavedBytes);
  console.log(`4. Re-loaded: pageCount=${reloaded.pageCount}, title="${reloaded.getTitle()}"`);
  assert(reloaded.pageCount === 1, 'Re-loaded page count should be 1');
  assert(reloaded.getTitle() === 'Round-trip Test', 'Title should survive round-trip');

  // Step 5: Check the PDF has stream content (compressed or not)
  const pdfText = new TextDecoder('latin1').decode(resavedBytes);
  const hasStreams = pdfText.includes('stream') && pdfText.includes('endstream');
  const hasFontRef = pdfText.includes('/Font');
  const hasMediaBox = pdfText.includes('/MediaBox');
  console.log(`5. Structure: hasStreams=${hasStreams}, hasFontRef=${hasFontRef}, hasMediaBox=${hasMediaBox}`);
  assert(hasStreams, 'Re-saved PDF should contain stream objects (content streams)');
  assert(hasFontRef, 'Re-saved PDF should contain /Font references');
  assert(hasMediaBox, 'Re-saved PDF should contain /MediaBox');

  // Step 6: Load → modify → save
  const loaded2 = await loadPdf(originalBytes);
  const page0 = loaded2.getPage(0);
  const newFont = await loaded2.embedFont('Courier');
  page0.drawText('Appended after load!', { x: 50, y: 400, font: newFont, size: 18 });
  const modifiedBytes = await loaded2.save();
  console.log(`6. Modified PDF: ${modifiedBytes.length} bytes`);

  // Re-load modified and verify
  const reloadedMod = await loadPdf(modifiedBytes);
  assert(reloadedMod.pageCount === 1, 'Modified PDF should have 1 page');
  console.log(`7. Re-loaded modified: pageCount=${reloadedMod.pageCount}`);

  // The modified PDF should reference both fonts
  const modText = new TextDecoder('latin1').decode(modifiedBytes);
  const hasCourier = modText.includes('/Courier');
  const hasHelvetica = modText.includes('/Helvetica');
  console.log(`8. Fonts: Helvetica=${hasHelvetica}, Courier=${hasCourier}`);
  assert(hasHelvetica || modText.includes('/F1'), 'Modified PDF should reference original font');
  assert(hasCourier || modText.includes('/F2'), 'Modified PDF should reference new Courier font');

  // Step 7: Multi-page PDF round-trip
  const multiDoc = createPdf();
  multiDoc.setTitle('Multi-page');
  for (let i = 0; i < 5; i++) {
    const p = multiDoc.addPage([612, 792]);
    const f = await multiDoc.embedFont('Helvetica');
    p.drawText(`Page ${i + 1}`, { x: 50, y: 700, font: f, size: 24 });
  }
  const multiBytes = await multiDoc.save();
  const multiLoaded = await loadPdf(multiBytes);
  assert(multiLoaded.pageCount === 5, 'Multi-page PDF should have 5 pages');
  const multiResaved = await multiLoaded.save();
  const multiReloaded = await loadPdf(multiResaved);
  assert(multiReloaded.pageCount === 5, 'Re-loaded multi-page should have 5 pages');
  console.log(`9. Multi-page: created ${multiBytes.length}b → loaded → resaved ${multiResaved.length}b → reloaded ${multiReloaded.pageCount} pages`);

  console.log('\n=== ALL ROUND-TRIP TESTS PASSED ===');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
