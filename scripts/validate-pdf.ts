#!/usr/bin/env tsx
/**
 * validate-pdf.ts — PDF structure validation utility
 *
 * Reads a PDF file and validates its structural integrity:
 *   - %PDF-1.x header
 *   - %%EOF trailer
 *   - Cross-reference table or stream
 *   - Trailer dictionary
 *   - Basic object structure
 *
 * Usage:
 *   npx tsx scripts/validate-pdf.ts <file.pdf>
 *   npm run validate-pdf -- <file.pdf>
 *
 * Exit codes:
 *   0 — All validations passed
 *   1 — One or more validations failed
 *   2 — Usage error (missing file, file not found)
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  name: string;
  passed: boolean;
  detail: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder('latin1');

function decodeBytes(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function findLast(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = haystack.length - needle.length; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

const encoder = new TextEncoder();

function toBytes(str: string): Uint8Array {
  return encoder.encode(str);
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateHeader(bytes: Uint8Array): ValidationResult {
  // The header must be within the first 1024 bytes per the spec
  const head = decodeBytes(bytes.subarray(0, 1024));
  const match = head.match(/%PDF-(\d+\.\d+)/);

  if (!match) {
    return {
      name: 'PDF Header',
      passed: false,
      detail: 'Missing %PDF-x.x header in the first 1024 bytes',
    };
  }

  return {
    name: 'PDF Header',
    passed: true,
    detail: `Found %PDF-${match[1]}`,
  };
}

function validateEof(bytes: Uint8Array): ValidationResult {
  // %%EOF must appear within the last 1024 bytes
  const tail = decodeBytes(bytes.subarray(Math.max(0, bytes.length - 1024)));

  if (!tail.includes('%%EOF')) {
    return {
      name: 'EOF Marker',
      passed: false,
      detail: 'Missing %%EOF marker in the last 1024 bytes',
    };
  }

  return {
    name: 'EOF Marker',
    passed: true,
    detail: 'Found %%EOF marker',
  };
}

function validateXref(bytes: Uint8Array): ValidationResult {
  const text = decodeBytes(bytes);

  // Traditional xref table
  const hasXrefTable = text.includes('xref\n') || text.includes('xref\r');

  // Cross-reference stream (PDF 1.5+) — identified by /Type /XRef in a stream object
  const hasXrefStream = text.includes('/Type /XRef') || text.includes('/Type/XRef');

  if (!hasXrefTable && !hasXrefStream) {
    return {
      name: 'Cross-Reference',
      passed: false,
      detail: 'No xref table or cross-reference stream found',
    };
  }

  const type = hasXrefTable ? 'xref table' : 'cross-reference stream';

  return {
    name: 'Cross-Reference',
    passed: true,
    detail: `Found ${type}`,
  };
}

function validateTrailer(bytes: Uint8Array): ValidationResult {
  const text = decodeBytes(bytes);

  // Traditional trailer dictionary
  const hasTrailer = text.includes('trailer');

  // For cross-reference streams, the trailer info is in the stream dictionary
  const hasXrefStream = text.includes('/Type /XRef') || text.includes('/Type/XRef');

  if (!hasTrailer && !hasXrefStream) {
    return {
      name: 'Trailer Dictionary',
      passed: false,
      detail: 'No trailer dictionary or cross-reference stream found',
    };
  }

  // Check for required /Size entry
  const hasSize = text.includes('/Size');
  if (!hasSize) {
    return {
      name: 'Trailer Dictionary',
      passed: false,
      detail: 'Trailer found but missing required /Size entry',
    };
  }

  // Check for /Root entry (document catalog)
  const hasRoot = text.includes('/Root');
  if (!hasRoot) {
    return {
      name: 'Trailer Dictionary',
      passed: false,
      detail: 'Trailer found but missing required /Root entry',
    };
  }

  return {
    name: 'Trailer Dictionary',
    passed: true,
    detail: 'Found trailer with /Size and /Root entries',
  };
}

function validateObjectStructure(bytes: Uint8Array): ValidationResult {
  const text = decodeBytes(bytes);

  // Look for at least one indirect object: "N N obj ... endobj"
  const objPattern = /\d+\s+\d+\s+obj/;
  const hasObjects = objPattern.test(text);

  if (!hasObjects) {
    return {
      name: 'Object Structure',
      passed: false,
      detail: 'No indirect objects (N N obj) found',
    };
  }

  // Count obj and endobj occurrences
  const objCount = (text.match(/\d+\s+\d+\s+obj\b/g) ?? []).length;
  const endobjCount = (text.match(/\bendobj\b/g) ?? []).length;

  if (objCount !== endobjCount) {
    return {
      name: 'Object Structure',
      passed: false,
      detail: `Mismatched obj/endobj count: ${objCount} obj vs ${endobjCount} endobj`,
    };
  }

  return {
    name: 'Object Structure',
    passed: true,
    detail: `Found ${objCount} indirect objects with matching endobj markers`,
  };
}

function validateStartxref(bytes: Uint8Array): ValidationResult {
  const tailBytes = bytes.subarray(Math.max(0, bytes.length - 1024));
  const tail = decodeBytes(tailBytes);

  const match = tail.match(/startxref\s+(\d+)/);
  if (!match) {
    return {
      name: 'startxref Pointer',
      passed: false,
      detail: 'Missing startxref pointer before %%EOF',
    };
  }

  const offset = parseInt(match[1], 10);

  return {
    name: 'startxref Pointer',
    passed: true,
    detail: `startxref points to byte offset ${offset}`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/validate-pdf.ts <file.pdf>');
    process.exit(2);
  }

  const filePath = resolve(args[0]!);

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(2);
  }

  console.log(`Validating: ${filePath}`);
  console.log('');

  const bytes = new Uint8Array(await readFile(filePath));

  console.log(`File size: ${(bytes.length / 1024).toFixed(1)} KB`);
  console.log('');

  // Run all validators
  const results: ValidationResult[] = [
    validateHeader(bytes),
    validateEof(bytes),
    validateStartxref(bytes),
    validateXref(bytes),
    validateTrailer(bytes),
    validateObjectStructure(bytes),
  ];

  // Print results
  const maxNameLen = Math.max(...results.map((r) => r.name.length));

  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const icon = result.passed ? '[ok]' : '[!!]';
    const paddedName = result.name.padEnd(maxNameLen);
    console.log(`  ${icon} ${paddedName}  ${result.detail}`);
  }

  console.log('');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  if (failed === 0) {
    console.log(`Result: All ${total} checks passed.`);
    process.exit(0);
  } else {
    console.log(`Result: ${passed}/${total} checks passed, ${failed} failed.`);
    process.exit(1);
  }
}

main();
