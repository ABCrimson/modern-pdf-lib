/**
 * G-API: the export surface of the built package, pinned by exports.api.json beside this file.
 *
 * The first test runs scripts/dev/api-snapshot.ts --json in a child process (plain Node, so the
 * built dist/ files load as a consumer loads them) and compares its output with the committed
 * snapshot. It needs dist/ and dist/wasm/: locally it skips with a reason when either is absent;
 * with `CI` set it fails instead (the CI job builds first). After an intended surface change:
 * `pnpm run build`, `pnpm run copy:wasm`, then this file with `-u`, and the CHANGELOG block below.
 *
 * The second test needs no dist/: it diffs the snapshot file at the previous release, tagged or
 * not (previousReleaseRef() in the script: its tag, else the commit that set its version),
 * against the working-tree file and requires the api-diff block of the topmost CHANGELOG.md
 * release to equal that diff. When that ref has no snapshot, the baseline is the working-tree
 * file, so the diff is empty. The topmost release must carry the block; for an empty diff it
 * reads `No export added, removed or changed.`. In a shallow clone (no history) it skips with a
 * reason locally and fails with `CI` set.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
  ROOT,
  SNAPSHOT_PATH,
  changelogApiBlock,
  diffSnapshots,
  formatDiff,
  previousReleaseRef,
  snapshotAtRef,
  workingSnapshot,
} from '../../../scripts/dev/api-snapshot.js';
import type { ApiSnapshot } from '../../../scripts/dev/api-snapshot.js';

const SCRIPT = join(ROOT, 'scripts/dev/api-snapshot.ts');

test('the built package exports the names, kinds and declarations of exports.api.json', async (ctx) => {
  const missing = ['dist/index.mjs', 'dist/wasm'].filter((p) => !existsSync(join(ROOT, p)));
  if (missing.length > 0) {
    const reason = `${missing.join(' and ')} absent: run \`pnpm run build\` and \`pnpm run copy:wasm\` first`;
    if (process.env.CI) throw new Error(reason);
    ctx.skip(reason);
  }
  const text = execFileSync(process.execPath, [SCRIPT, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const built = JSON.parse(text) as ApiSnapshot;
  const hint = existsSync(join(ROOT, SNAPSHOT_PATH))
    ? `export surface changed:\n${formatDiff(diffSnapshots(workingSnapshot(), built))}`
    : `no ${SNAPSHOT_PATH} yet`;
  await expect(text).toMatchFileSnapshot('./exports.api.json', hint);
});

test('the topmost CHANGELOG api-diff block equals the snapshot diff against the previous release', (ctx) => {
  const shallow =
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim() === 'true';
  if (shallow) {
    const reason = 'shallow clone: the release tags and their snapshots are absent';
    if (process.env.CI) throw new Error(`${reason} (check out with fetch-depth: 0)`);
    ctx.skip(reason);
  }
  const ref = previousReleaseRef();
  const current = workingSnapshot();
  const baseline = (ref === undefined ? undefined : snapshotAtRef(ref)) ?? current;
  const diff = diffSnapshots(baseline, current);
  const block = changelogApiBlock(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'));
  const against = ref ?? 'no previous release';
  expect(
    block,
    `the topmost CHANGELOG.md release needs an api-diff block (diff against ${against})`,
  ).toBeDefined();
  expect(block, `CHANGELOG.md api-diff block against ${against}`).toBe(formatDiff(diff));
});
