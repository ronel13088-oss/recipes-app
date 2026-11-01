import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// End-to-end: a real `git commit -a` with the pre-commit hook in a scratch copy of this repo (linked worktree, like
// our review flow) must commit only the intended file and must not flip core.bare. Guarded against recursion.
test('pre-commit hook: test scratch repos do not leak into the committing repo', { skip: process.env.HOOK_ENV_INNER === '1' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hookenv-')); const main = path.join(tmp, 'main'); const wt = path.join(tmp, 'wt');
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && k !== 'NODE_TEST_CONTEXT')), HOOK_ENV_INNER: '1' };
  const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, env, encoding: 'utf8' });
  fs.mkdirSync(main);
  g(main, 'init', '-q');
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && fs.existsSync(path.join(ROOT, f)));
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(main, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(main, f)); }
  g(main, 'add', '-A'); g(main, 'commit', '-q', '--no-verify', '-m', 'base');
  g(main, 'worktree', 'add', '-q', '-b', 'b', wt);
  g(wt, 'config', 'core.hooksPath', '.githooks');
  fs.appendFileSync(path.join(wt, 'README.md'), '\nhook-env probe\n');
  g(wt, 'commit', '-q', '-a', '-m', 'probe');
  const changed = g(wt, 'show', '--name-only', '--format=', 'HEAD').trim().split('\n').filter(f => f !== 'sw.js');
  assert.deepEqual(changed, ['README.md']);
  assert.equal(g(main, 'config', 'core.bare').trim(), 'false');
  fs.rmSync(tmp, { recursive: true, force: true });
});
