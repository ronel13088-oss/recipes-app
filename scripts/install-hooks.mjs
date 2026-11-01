#!/usr/bin/env node
// Points git at .githooks/ so pre-commit runs the real-data guard, tests and SW version stamp.
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
try { execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' }); } catch { console.log('not a git repo yet – run `git init && npm run setup`'); process.exit(0); }
execFileSync('git', ['config', 'core.hooksPath', '.githooks']); fs.chmodSync('.githooks/pre-commit', 0o755);
console.log('hooks installed: .githooks/pre-commit');
