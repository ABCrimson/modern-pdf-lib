#!/usr/bin/env tsx
/**
 * veraPDF validation wrapper for CI.
 *
 * Downloads the veraPDF CLI (requires Java 11+) and validates
 * PDF files against PDF/A conformance levels.
 *
 * Usage: npx tsx scripts/verapdf-validate.ts <file.pdf> [--level 1b]
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const VERAPDF_VERSION = '1.26.2';
const CACHE_DIR = join(import.meta.dirname, '..', '.cache', 'verapdf');
const VERAPDF_URL = `https://software.verapdf.org/releases/verapdf-installer-${VERAPDF_VERSION}.zip`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  file: string;
  level: string;
  valid: boolean;
  errors: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check that Java 11+ is available on the system. */
function checkJava(): void {
  try {
    const output = execSync('java -version 2>&1', { encoding: 'utf-8' });
    const match = output.match(/version "(\d+)/);
    if (match) {
      const major = parseInt(match[1]!, 10);
      if (major < 11) {
        console.error(`Java ${major} detected — veraPDF requires Java 11+.`);
        process.exit(2);
      }
    }
  } catch {
    console.error('Java not found. veraPDF requires Java 11+ on the PATH.');
    process.exit(2);
  }
}

/**
 * Resolve the veraPDF executable path inside the cache directory.
 * After extraction there may be a nested directory — walk into it.
 */
async function resolveVeraPdfBinary(): Promise<string | undefined> {
  // Try common locations after extraction
  const candidates = [
    join(CACHE_DIR, 'verapdf', 'verapdf'),
    join(CACHE_DIR, 'verapdf', 'verapdf.bat'),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // Walk one level deep in case the zip contained a versioned dir
  if (existsSync(CACHE_DIR)) {
    const entries = await readdir(CACHE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nested = join(CACHE_DIR, entry.name, 'verapdf');
        if (existsSync(nested)) return nested;
        const nestedBat = join(CACHE_DIR, entry.name, 'verapdf.bat');
        if (existsSync(nestedBat)) return nestedBat;
      }
    }
  }

  return undefined;
}

/** Download and extract veraPDF if not already cached. */
async function ensureVeraPdf(): Promise<string> {
  const existing = await resolveVeraPdfBinary();
  if (existing) return existing;

  console.log(`Downloading veraPDF ${VERAPDF_VERSION}...`);
  await mkdir(CACHE_DIR, { recursive: true });

  const response = await fetch(VERAPDF_URL);
  if (!response.ok) {
    throw new Error(`Failed to download veraPDF: ${response.status} ${response.statusText}`);
  }

  const zipPath = join(CACHE_DIR, 'verapdf.zip');
  const buffer = new Uint8Array(await response.arrayBuffer());
  await writeFile(zipPath, buffer);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Extract — platform-dependent
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${CACHE_DIR}' -Force"`, {
      stdio: 'pipe',
    });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${CACHE_DIR}"`, { stdio: 'pipe' });
  }

  const verapdfPath = await resolveVeraPdfBinary();
  if (!verapdfPath) {
    throw new Error('veraPDF extraction failed — binary not found in cache directory.');
  }

  // Make executable on Unix
  if (!isWindows) {
    execSync(`chmod +x "${verapdfPath}"`, { stdio: 'pipe' });
  }

  console.log(`veraPDF ready at: ${verapdfPath}`);
  return verapdfPath;
}

/**
 * Map our level shorthand (1b, 2b, 3b, 1a, 2a, 3a, 2u, 3u)
 * to veraPDF flavour identifiers.
 */
function mapLevelToFlavour(level: string): string {
  const map: Record<string, string> = {
    '1a': '1a',
    '1b': '1b',
    '2a': '2a',
    '2b': '2b',
    '2u': '2u',
    '3a': '3a',
    '3b': '3b',
    '3u': '3u',
  };
  return map[level] ?? level;
}

/** Run veraPDF validation on a single file. */
async function validate(file: string, level: string): Promise<ValidationResult> {
  const verapdf = await ensureVeraPdf();
  const flavour = mapLevelToFlavour(level);

  try {
    const output = execSync(
      `"${verapdf}" --format text --flavour ${flavour} "${file}"`,
      { encoding: 'utf-8', timeout: 60_000 },
    );

    const valid = output.includes('PASS') && !output.includes('FAIL');
    const errors = output
      .split('\n')
      .filter((l) => l.includes('FAIL'))
      .map((l) => l.trim());

    return {
      file,
      level,
      valid,
      errors,
      summary: valid ? 'All rules passed' : `${errors.length} rule(s) failed`,
    };
  } catch (err: unknown) {
    // veraPDF exits non-zero when validation fails — parse stdout from the error
    if (err && typeof err === 'object' && 'stdout' in err) {
      const stdout = String((err as { stdout: unknown }).stdout);
      const errors = stdout
        .split('\n')
        .filter((l) => l.includes('FAIL'))
        .map((l) => l.trim());

      return {
        file,
        level,
        valid: false,
        errors,
        summary: `${errors.length} rule(s) failed`,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      file,
      level,
      valid: false,
      errors: [message],
      summary: 'Validation error',
    };
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const levelIdx = args.indexOf('--level');
const level = levelIdx >= 0 ? args[levelIdx + 1] ?? '1b' : '1b';

if (!file) {
  console.error('Usage: npx tsx scripts/verapdf-validate.ts <file.pdf> [--level 1b]');
  console.error('');
  console.error('Options:');
  console.error('  --level <level>  PDF/A conformance level (1a|1b|2a|2b|2u|3a|3b|3u)');
  console.error('                   Default: 1b');
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`Error: File not found: ${file}`);
  process.exit(2);
}

// Validate Java is present
checkJava();

const result = await validate(file, level);

console.log('');
console.log(JSON.stringify(result, null, 2));

process.exit(result.valid ? 0 : 1);
