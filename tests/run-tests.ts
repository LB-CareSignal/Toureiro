#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
let mochaArgs: string[] = [];
let target: string | undefined;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--') {
    mochaArgs = mochaArgs.concat(args.slice(i + 1));
    break;
  }

  if (arg === '--target') {
    target = args[i + 1];
    i++;
    continue;
  }

  if (arg.startsWith('--target=')) {
    target = arg.slice('--target='.length);
    continue;
  }

  if (arg === '--dry-run') {
    dryRun = true;
    continue;
  }

  mochaArgs.push(arg);
}

if (target) {
  mochaArgs.unshift('--grep', target);
}

if (!mochaArgs.includes('--exit') && !mochaArgs.includes('--no-exit')) {
  mochaArgs.unshift('--exit');
}

const projectDir = process.cwd();
const testsDir = join(projectDir, 'tests');
const testFiles = readdirSync(testsDir)
  .filter(function(fileName) {
    return /^test_.*\.(js|ts)$/.test(fileName);
  })
  .sort()
  .map(function(fileName) {
    return join('tests', fileName);
  });

if (testFiles.some(function(fileName) { return fileName.endsWith('.ts'); }) && !mochaArgs.includes('--require')) {
  mochaArgs.unshift('--require', 'tsx/cjs');
}

const commandArgs = mochaArgs.concat(testFiles);

if (dryRun) {
  console.log('mocha ' + commandArgs.join(' '));
  process.exit(0);
}

const mochaBin = join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'mocha.cmd' : 'mocha');
const child = spawn(mochaBin, commandArgs, {
  cwd: projectDir,
  stdio: 'inherit'
});

child.on('error', function(err: Error) {
  console.error(err.message);
  process.exit(1);
});

child.on('exit', function(code: number | null, signal: NodeJS.Signals | null) {
  if (signal) {
    console.error('mocha exited with signal ' + signal);
    process.exit(1);
  }
  process.exit(code || 0);
});
