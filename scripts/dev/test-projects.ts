/**
 * Proves that the Vitest projects in vitest.config.ts partition the test tree: every
 * `tests/**\/*.test.ts` file belongs to exactly one project.
 *
 *   node scripts/dev/test-projects.ts --check               exit 1 when a file matches no
 *                                                           project or more than one
 *   node scripts/dev/test-projects.ts --check --root <dir>  the same for another checkout
 *                                                           (its vitest.config.ts and tests/)
 *
 * The files of each project come from Vitest itself (`TestProject.globTestFiles()` of the
 * installed `vitest/node`), so the check matches what `vitest run --project <name>` runs. Files
 * on disk are found with `fs.globSync`. Node strips the types, so only erasable syntax is used.
 */
import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createVitest } from 'vitest/node';

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    root: { type: 'string', default: '.' },
  },
});

if (!values.check) {
  console.error('usage: node scripts/dev/test-projects.ts --check [--root <dir>]');
  process.exit(2);
}

const root = resolve(values.root);
const key = (file: string): string => resolve(root, file).replaceAll('\\', '/');

const onDisk = globSync('tests/**/*.test.ts', { cwd: root }).map(key).sort();

const vitest = await createVitest(
  'test',
  { root, config: resolve(root, 'vitest.config.ts'), watch: false },
  {},
  { stdout: process.stderr },
);
const owners = new Map<string, string[]>();
const projects: string[] = [];
try {
  for (const project of vitest.projects) {
    projects.push(project.name);
    const { testFiles } = await project.globTestFiles();
    for (const file of testFiles) {
      const list = owners.get(key(file)) ?? [];
      list.push(project.name);
      owners.set(key(file), list);
    }
  }
} finally {
  await vitest.close();
}

const relative = (file: string): string => file.slice(key('.').length + 1);
const unmatched = onDisk.filter((file) => !owners.has(file));
const double = [...owners].filter(([, names]) => names.length > 1);

for (const file of unmatched) console.error(`no project: ${relative(file)}`);
for (const [file, names] of double)
  console.error(`${names.length} projects (${names.join(', ')}): ${relative(file)}`);
console.log(
  `${onDisk.length} files, ${projects.length} projects (${projects.join(', ')}), ` +
    `${unmatched.length} unmatched, ${double.length} double`,
);
process.exit(unmatched.length === 0 && double.length === 0 ? 0 : 1);
