import { createPdf, loadPdf, rgb } from '../src/index.js';

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  

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
  

  // Step 2: Load the PDF
  const loaded = await loadPdf(originalBytes);
  
  assert(loaded.pageCount === 1, 'Loaded page count should be 1');
  assert(loaded.getTitle() === 'Round-trip Test', 'Title should survive load');
  assert(loaded.getAuthor() === 'modern-pdf', 'Author should survive load');

  // Step 3: Save the loaded PDF (no modifications)
  const resavedBytes = await loaded.save();
  

  // Verify the re-saved PDF is a valid PDF
  const header = new TextDecoder('ascii').decode(resavedBytes.subarray(0, 5));
  assert(header === '%PDF-', 'Re-saved should start with %PDF-');

  // Step 4: Re-load the re-saved PDF and verify structure
  const reloaded = await loadPdf(resavedBytes);
  
  assert(reloaded.pageCount === 1, 'Re-loaded page count should be 1');
  assert(reloaded.getTitle() === 'Round-trip Test', 'Title should survive round-trip');

  // Step 5: Check the PDF has stream content (compressed or not)
  const pdfText = new TextDecoder('latin1').decode(resavedBytes);
  const hasStreams = pdfText.includes('stream') && pdfText.includes('endstream');
  const hasFontRef = pdfText.includes('/Font');
  const hasMediaBox = pdfText.includes('/MediaBox');
  
  assert(hasStreams, 'Re-saved PDF should contain stream objects (content streams)');
  assert(hasFontRef, 'Re-saved PDF should contain /Font references');
  assert(hasMediaBox, 'Re-saved PDF should contain /MediaBox');

  // Step 6: Load → modify → save
  const loaded2 = await loadPdf(originalBytes);
  const page0 = loaded2.getPage(0);
  const newFont = await loaded2.embedFont('Courier');
  page0.drawText('Appended after load!', { x: 50, y: 400, font: newFont, size: 18 });
  const modifiedBytes = await loaded2.save();
  

  // Re-load modified and verify
  const reloadedMod = await loadPdf(modifiedBytes);
  assert(reloadedMod.pageCount === 1, 'Modified PDF should have 1 page');
  

  // The modified PDF should reference both fonts
  const modText = new TextDecoder('latin1').decode(modifiedBytes);
  const hasCourier = modText.includes('/Courier');
  const hasHelvetica = modText.includes('/Helvetica');
  
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
  

  
}

main().catch((err) => {
  
  process.exit(1);
});
