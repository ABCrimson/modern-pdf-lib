#!/usr/bin/env node
/**
 * @module cli/index
 *
 * CLI entry point for modern-pdf-lib.
 *
 * Usage:
 *   npx modern-pdf optimize input.pdf output.pdf [options]
 *   npx modern-pdf --help
 */

import { optimizeCommand } from './optimize.js';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  // Read version from package.json at runtime
  console.log('modern-pdf-lib CLI');
  process.exit(0);
}

switch (command) {
  case 'optimize':
    await optimizeCommand(args.slice(1));
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "modern-pdf --help" for usage information.');
    process.exit(1);
}

function printHelp(): void {
  console.log(`
modern-pdf-lib CLI

Usage:
  modern-pdf <command> [options]

Commands:
  optimize    Optimize images in a PDF file

Options:
  --help, -h      Show this help message
  --version, -v   Show version

Run "modern-pdf optimize --help" for optimize options.
`.trim());
}
