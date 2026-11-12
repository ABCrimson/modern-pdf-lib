/**
 * previousReleaseRef() of scripts/dev/api-snapshot.ts, the baseline of the api-diff gate, on
 * temporary git repositories built here, so the cases do not depend on this repo's tags or
 * history. A release is a commit that sets package.json "version" and adds a `## [x.y.z]`
 * CHANGELOG heading; it may or may not carry a `vX.Y.Z` tag.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { previousReleaseRef } from '../../../scripts/dev/api-snapshot.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

class Repo {
  readonly dir = mkdtempSync(join(tmpdir(), 'prev-release-'));
  private headings: string[] = [];

  constructor() {
    dirs.push(this.dir);
    this.git('init', '--quiet');
  }

  git(...args: string[]): string {
    return execFileSync(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.autocrlf=false',
        '-c',
        'core.safecrlf=false',
        '-c',
        'tag.gpgsign=false',
        ...args,
      ],
      { cwd: this.dir, encoding: 'utf8' },
    ).trim();
  }

  /** A commit that sets the version and, with `heading`, adds the CHANGELOG heading. */
  release(version: string, heading = true): string {
    if (heading) this.headings.unshift(`## [${version}] - 2026-01-01\n\n- change\n`);
    writeFileSync(join(this.dir, 'package.json'), `{\n  "version": "${version}"\n}\n`);
    writeFileSync(join(this.dir, 'CHANGELOG.md'), `# Changelog\n\n${this.headings.join('\n')}`);
    this.git('add', '.');
    this.git('commit', '--quiet', '-m', `release ${version}`);
    return this.git('rev-parse', 'HEAD');
  }

  /** A commit that leaves the version alone. */
  other(): void {
    writeFileSync(join(this.dir, 'other.txt'), `${Math.random()}\n`);
    this.git('add', '.');
    this.git('commit', '--quiet', '-m', 'other');
  }
}

describe('previousReleaseRef', () => {
  test('a tagged previous release resolves to its tag', () => {
    const repo = new Repo();
    repo.release('1.0.0');
    repo.git('tag', 'v1.0.0');
    repo.release('1.1.0');
    expect(previousReleaseRef(repo.dir)).toBe('v1.0.0');
  });

  test('an untagged previous release resolves to the commit that set its version', () => {
    const repo = new Repo();
    const first = repo.release('1.0.0');
    repo.other();
    repo.release('1.1.0');
    expect(previousReleaseRef(repo.dir)).toBe(first);
  });

  test('stacked untagged releases skip an older tag and pick the newest one below', () => {
    const repo = new Repo();
    repo.release('0.9.0');
    repo.git('tag', 'v0.9.0');
    repo.release('1.0.0');
    const second = repo.release('1.1.0');
    repo.other();
    repo.release('1.2.0');
    expect(previousReleaseRef(repo.dir)).toBe(second);
  });

  test('a tag on the current version is not its own baseline', () => {
    const repo = new Repo();
    repo.release('1.0.0');
    repo.git('tag', 'v1.0.0');
    repo.release('1.1.0');
    repo.git('tag', 'v1.1.0');
    expect(previousReleaseRef(repo.dir)).toBe('v1.0.0');
  });

  test('a release heading whose commit cannot be found falls back to the newest tag below', () => {
    const repo = new Repo();
    repo.release('0.9.0');
    repo.git('tag', 'v0.9.0');
    repo.release('1.1.0');
    writeFileSync(
      join(repo.dir, 'CHANGELOG.md'),
      '# Changelog\n\n## [1.1.0] - 2026-01-01\n\n## [1.0.0] - 2026-01-01\n',
    );
    expect(previousReleaseRef(repo.dir)).toBe('v0.9.0');
  });

  test('no previous release gives undefined', () => {
    const repo = new Repo();
    repo.release('1.0.0');
    expect(previousReleaseRef(repo.dir)).toBeUndefined();
  });
});
