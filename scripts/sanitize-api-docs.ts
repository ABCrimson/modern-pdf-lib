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
 * blocks (```) and inline code spans (`) untouched so signatures still render.
 * Run automatically after `docs:api`.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_DIR = 'docs/api';

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

const ESCAPES: Readonly<Record<string, string>> = {
  '{': '&#123;',
  '}': '&#125;',
  '<': '&lt;',
  '>': '&gt;',
};

/** Escape Vue/markdown-hostile chars in prose, preserving fenced + inline code. */
function sanitize(markdown: string): string {
  const out: string[] = [];
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
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
for await (const file of walk(API_DIR)) {
  const original = await readFile(file, 'utf8');
  const fixed = sanitize(original);
  if (fixed !== original) {
    await writeFile(file, fixed);
    changed += 1;
  }
}
process.stdout.write(`sanitize-api-docs: escaped Vue-hostile chars in ${changed} file(s)\n`);
