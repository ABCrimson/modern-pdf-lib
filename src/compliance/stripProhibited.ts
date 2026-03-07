/**
 * Strip PDF/A prohibited features from raw PDF bytes.
 *
 * PDF/A prohibits several features. This module removes them
 * from the raw PDF bytes so that enforcePdfA can fix documents
 * that would otherwise be rejected.
 *
 * Prohibited features (PDF/A-1 through PDF/A-3):
 * - JavaScript actions (/JS, /JavaScript)
 * - Launch actions (/Launch)
 * - Sound actions (/Sound)
 * - Movie actions (/Movie)
 * - ResetForm actions (/ResetForm)
 * - ImportData actions (/ImportData)
 * - Named actions except NextPage, PrevPage, FirstPage, LastPage
 * - Encryption (/Encrypt)
 * - Embedded multimedia (/RichMedia)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Result returned by {@link stripProhibitedFeatures}. */
export interface StripResult {
  /** Modified PDF bytes. */
  readonly bytes: Uint8Array;
  /** Features that were stripped. */
  readonly stripped: StrippedFeature[];
  /** Whether any modifications were made. */
  readonly modified: boolean;
}

/** A single category of stripped feature. */
export interface StrippedFeature {
  /** Feature type that was stripped (e.g. "JavaScript", "Launch"). */
  readonly type: string;
  /** Number of occurrences that were removed/neutralized. */
  readonly count: number;
}

/** Options controlling which prohibited features to strip. */
export interface StripOptions {
  /** Strip /JavaScript and /JS actions. Default: `true`. */
  stripJavaScript?: boolean;
  /** Strip /Launch actions. Default: `true`. */
  stripLaunch?: boolean;
  /** Strip /Sound actions. Default: `true`. */
  stripSound?: boolean;
  /** Strip /Movie actions. Default: `true`. */
  stripMovie?: boolean;
  /** Strip /RichMedia annotations. Default: `true`. */
  stripRichMedia?: boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Count non-overlapping occurrences of `pattern` in `text`.
 *
 * @internal Exported only for unit testing.
 */
export function countOccurrences(text: string, pattern: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(pattern, pos)) >= 0) {
    count++;
    pos += pattern.length;
  }
  return count;
}

/**
 * Strip prohibited features from PDF bytes.
 *
 * Each prohibited feature category can be individually enabled or disabled
 * via {@link StripOptions}. By default all categories are stripped.
 *
 * Stripping works by replacing action type entries with harmless equivalents
 * (e.g. `/S /JavaScript` becomes `/S /URI`) and removing inline script
 * payloads (`/JS (...)` or `/JS <...>`).
 *
 * @param pdfBytes - Raw PDF bytes.
 * @param options  - What to strip. All categories enabled by default.
 * @returns Modified bytes and a strip report.
 */
export function stripProhibitedFeatures(
  pdfBytes: Uint8Array,
  options: StripOptions = {},
): StripResult {
  const stripped: StrippedFeature[] = [];
  let text = new TextDecoder().decode(pdfBytes);
  let modified = false;

  // --- Strip JavaScript actions ---
  if (options.stripJavaScript !== false) {
    const jsActionCount = countOccurrences(text, '/S /JavaScript')
      + countOccurrences(text, '/S/JavaScript');
    const jsEntryCount = countMatches(text, /\/JS\s*\([^)]*\)/g)
      + countMatches(text, /\/JS\s*<[^>]*>/g);
    const totalJs = jsActionCount + jsEntryCount;

    if (totalJs > 0) {
      // Neutralize /S /JavaScript action type
      text = text.replace(/\/S\s*\/JavaScript/g, '/S /URI        ');
      // Remove /JS literal-string entries: /JS (code...)
      text = text.replace(/\/JS\s*\([^)]*\)/g, '');
      // Remove /JS hex-string entries: /JS <hex...>
      text = text.replace(/\/JS\s*<[^>]*>/g, '');
      stripped.push({ type: 'JavaScript', count: totalJs });
      modified = true;
    }
  }

  // --- Strip Launch actions ---
  if (options.stripLaunch !== false) {
    const launchCount = countOccurrences(text, '/S /Launch')
      + countOccurrences(text, '/S/Launch');
    if (launchCount > 0) {
      text = text.replace(/\/S\s*\/Launch/g, '/S /URI   ');
      stripped.push({ type: 'Launch', count: launchCount });
      modified = true;
    }
  }

  // --- Strip Sound actions ---
  if (options.stripSound !== false) {
    const soundCount = countOccurrences(text, '/S /Sound')
      + countOccurrences(text, '/S/Sound');
    if (soundCount > 0) {
      text = text.replace(/\/S\s*\/Sound/g, '/S /URI  ');
      stripped.push({ type: 'Sound', count: soundCount });
      modified = true;
    }
  }

  // --- Strip Movie actions ---
  if (options.stripMovie !== false) {
    const movieCount = countOccurrences(text, '/S /Movie')
      + countOccurrences(text, '/S/Movie');
    if (movieCount > 0) {
      text = text.replace(/\/S\s*\/Movie/g, '/S /URI  ');
      stripped.push({ type: 'Movie', count: movieCount });
      modified = true;
    }
  }

  // --- Strip RichMedia annotations ---
  if (options.stripRichMedia !== false) {
    const richCount = countOccurrences(text, '/Subtype /RichMedia')
      + countOccurrences(text, '/Subtype/RichMedia');
    if (richCount > 0) {
      text = text.replace(/\/Subtype\s*\/RichMedia/g, '/Subtype /Link     ');
      stripped.push({ type: 'RichMedia', count: richCount });
      modified = true;
    }
  }

  return {
    bytes: modified ? new TextEncoder().encode(text) : pdfBytes,
    stripped,
    modified,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Count regex matches in a string. */
function countMatches(text: string, regex: RegExp): number {
  let count = 0;
  // Ensure the regex has the global flag
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  while (re.exec(text) !== null) {
    count++;
  }
  return count;
}
