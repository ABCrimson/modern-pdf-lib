/**
 * Sanitize typedoc-generated API markdown for VitePress.
 *
 * VitePress compiles every `.md` file as a Vue SFC, so characters that are
 * meaningful to the Vue template / markdown-it attribute parser — `{ }` (read
 * as element-attribute syntax, e.g. from a JSDoc `@default { top: 36, ... }`)
 * and bare `< >` (read as HTML tags / generics) — break the build with
 * "Duplicate attribute" / parse errors.
 *
 * This pass HTML-escapes those characters in prose only, leaving fenced code
 * blocks (``` or ~~~) and inline code spans (`) untouched so signatures still
 * render. Runs as the second step of `pnpm run docs:api`, after typedoc.
 */

import { glob, readFile, writeFile } from 'node:fs/promises';

const API_DIR = 'docs/api';

/**
 * Code-fence line: three or more backticks or tildes, up to 3 spaces of indent.
 * Group 1 is the marker, group 2 the info string (trailing CR dropped).
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*?)\r?$/;

const ESCAPES: Readonly<Record<string, string>> = {
  '{': '&#123;',
  '}': '&#125;',
  '<': '&lt;',
  '>': '&gt;',
};

/** Escape Vue/markdown-hostile chars in prose, preserving fenced + inline code. */
function sanitize(markdown: string): string {
  const out: string[] = [];
  // The marker (e.g. "```" or "~~~~") that opened the current fenced block, if any.
  let openFence: string | undefined;

  for (const line of markdown.split('\n')) {
    const [, marker, rest = ''] = FENCE.exec(line) ?? [];
    if (openFence !== undefined) {
      // A closing fence uses the same character, is at least as long as the opener, and has no info string.
      if (
        marker !== undefined &&
        marker[0] === openFence[0] &&
        marker.length >= openFence.length &&
        /^[ \t]*$/.test(rest)
      ) {
        openFence = undefined;
      }
      out.push(line);
      continue;
    }
    // A backtick opener whose info string contains a backtick is inline code, not a fence.
    if (marker !== undefined && !(marker[0] === '`' && rest.includes('`'))) {
      openFence = marker;
      out.push(line);
      continue;
    }

    let escaped = '';
    let inInlineCode = false;
    for (const ch of line) {
      if (ch === '`') {
        inInlineCode = !inInlineCode;
        escaped += ch;
      } else if (!inInlineCode && ch in ESCAPES) {
        escaped += ESCAPES[ch];
      } else {
        escaped += ch;
      }
    }
    out.push(escaped);
  }

  return out.join('\n');
}

let changed = 0;
for await (const file of glob(`${API_DIR}/**/*.md`)) {
  const original = await readFile(file, 'utf8');
  const fixed = sanitize(original);
  if (fixed !== original) {
    await writeFile(file, fixed);
    changed += 1;
  }
}
process.stdout.write(`sanitize-api-docs: escaped Vue-hostile chars in ${changed} file(s)\n`);
