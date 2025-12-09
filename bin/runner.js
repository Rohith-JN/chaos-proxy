#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Detect OS and find binary
const platform = os.platform();
let binaryName = 'chaos-proxy';
if (platform === 'win32') binaryName = 'chaos-proxy.exe';

const binaryPath = path.join(__dirname, binaryName);

// 3. Pass args
const args = process.argv.slice(2);

// 4. Spawn Go Process
const child = spawn(binaryPath, args, { stdio: 'inherit' });

child.on('close', (code) => {
  if (code !== null) process.exit(code);
});
