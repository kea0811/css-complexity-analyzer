#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  analyzeDirectory,
  formatReportAsJSON,
  checkThresholds,
  type AnalyzerConfig,
} from './core/index.js';
import { formatReport, formatCheckResult } from './formatter.js';
import { findConfig, writeConfigFile } from './config.js';

const VERSION = '0.1.2';

const program = new Command();

program
  .name('css-complexity-analyzer')
  .description('Analyze CSS complexity - profile cascade, specificity, fragility, and layout risk')
  .version(VERSION);

// Analyze command
program
  .command('analyze')
  .description('Analyze CSS files and generate a complexity report')
  .argument('[path]', 'Path to analyze (file or directory)', '.')
  .option('-i, --include <patterns...>', 'Glob patterns to include')
  .option('-e, --exclude <patterns...>', 'Glob patterns to exclude')
  .option('-f, --format <type>', 'Output format: text or json', 'text')
  .option('-o, --out <file>', 'Write report to file')
  .option('-s, --silent', 'Suppress console output')
  .option('--no-config', 'Ignore config files')
  .action(async (inputPath: string, options) => {
    try {
      const targetPath = path.resolve(inputPath);

      // Load config
      let config: AnalyzerConfig = {};
      if (options.config !== false) {
        const foundConfig = await findConfig(targetPath);
        if (foundConfig) {
          config = foundConfig;
        }
      }

      // Override with CLI options
      if (options.include) {
        config.include = options.include;
      }
      if (options.exclude) {
        config.exclude = options.exclude;
      }

      // Run analysis
      const report = await analyzeDirectory(targetPath, config);

      // Format output
      if (options.format === 'json') {
        const jsonOutput = formatReportAsJSON(report);
        if (options.out) {
          await fs.writeFile(options.out, jsonOutput, 'utf-8');
          if (!options.silent) {
            console.log(`Report written to ${options.out}`);
          }
        } else if (!options.silent) {
          console.log(jsonOutput);
        }
      } else {
        const textOutput = formatReport(report, { silent: options.silent });
        if (options.out) {
          await fs.writeFile(options.out, textOutput, 'utf-8');
          if (!options.silent) {
            console.log(`Report written to ${options.out}`);
          }
        } else {
          console.log(textOutput);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Check command (for CI)
program
  .command('check')
  .description('Check if CSS complexity passes thresholds (for CI)')
  .argument('[path]', 'Path to analyze', '.')
  .option('--max-score <score>', 'Maximum allowed score', '60')
  .option('--max-high-severity <count>', 'Maximum allowed high severity issues', '0')
  .option('-s, --silent', 'Suppress console output (only exit code)')
  .option('--no-config', 'Ignore config files')
  .action(async (inputPath: string, options) => {
    try {
      const targetPath = path.resolve(inputPath);

      // Load config
      let config: AnalyzerConfig = {};
      if (options.config !== false) {
        const foundConfig = await findConfig(targetPath);
        if (foundConfig) {
          config = foundConfig;
        }
      }

      // Override maxScore from CLI
      config.maxScore = parseInt(options.maxScore, 10);

      // Run analysis
      const report = await analyzeDirectory(targetPath, config);

      // Check thresholds
      const { passed, reasons } = checkThresholds(report, config);

      // Check additional CLI thresholds
      const maxHighSeverity = parseInt(options.maxHighSeverity, 10);
      if (report.summary.issuesBySeverity.high > maxHighSeverity) {
        reasons.push(
          `High severity issues (${report.summary.issuesBySeverity.high}) exceed maximum (${maxHighSeverity})`
        );
      }

      const finalPassed = passed && reasons.length === 0;

      if (!options.silent) {
        console.log(formatCheckResult(finalPassed, reasons, report.summary.overallScore));
      }

      process.exit(finalPassed ? 0 : 1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Generate a .csscomplexityrc.json config file')
  .argument('[path]', 'Directory to create config in', '.')
  .action(async (inputPath: string) => {
    try {
      const targetPath = path.resolve(inputPath);
      const configPath = await writeConfigFile(targetPath);
      console.log(`Created config file: ${configPath}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
