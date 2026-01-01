import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type {
  Report,
  AnalyzerConfig,
  ParseResult,
  FileMetrics,
  AnalysisInput,
} from './types.js';
import { parseCSS, parseCSSFile } from './parser.js';
import { calculateFileMetrics, calculateGlobalMetrics, extractTopSelectors } from './metrics.js';
import { runAllRules } from './rules.js';
import { generateSummary, generateRecommendations } from './scoring.js';

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: AnalyzerConfig = {}): Required<AnalyzerConfig> {
  const defaultConfig: Required<AnalyzerConfig> = {
    include: ['**/*.css'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/vendor/**'],
    thresholds: {
      maxSelectorDepth: 4,
      maxSpecificityScore: 40,
      maxImportantPerFile: 5,
      maxDuplicateDeclarations: 3,
    },
    ignorePatterns: [],
    maxScore: 100,
    rules: {
      deepSelectors: true,
      highSpecificity: true,
      importantAbuse: true,
      duplicateDeclarations: true,
      layoutRiskHotspot: true,
      overridePressure: true,
    },
  };

  return {
    include: userConfig.include ?? defaultConfig.include,
    exclude: userConfig.exclude ?? defaultConfig.exclude,
    thresholds: {
      ...defaultConfig.thresholds,
      ...userConfig.thresholds,
    },
    ignorePatterns: userConfig.ignorePatterns ?? defaultConfig.ignorePatterns,
    maxScore: userConfig.maxScore ?? defaultConfig.maxScore,
    rules: {
      ...defaultConfig.rules,
      ...userConfig.rules,
    },
  };
}

/**
 * Find CSS files based on include/exclude patterns
 */
export async function findCSSFiles(
  basePath: string,
  config: Required<AnalyzerConfig>
): Promise<string[]> {
  const files: string[] = [];
  const absoluteBase = path.resolve(basePath);

  for (const pattern of config.include) {
    try {
      const matches = await glob(pattern, {
        cwd: absoluteBase,
        absolute: true,
        ignore: config.exclude,
        nodir: true,
      });
      files.push(...matches);
    } catch /* istanbul ignore next - defensive handling when glob throws */ {
      // Pattern matching failed, try as literal path
      const literalPath = path.join(absoluteBase, pattern);
      try {
        await fs.access(literalPath);
        files.push(literalPath);
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  return [...new Set(files)]; // Remove duplicates
}

/**
 * Parse multiple CSS files
 */
export async function parseFiles(filePaths: string[]): Promise<ParseResult[]> {
  const results: ParseResult[] = [];

  for (const filePath of filePaths) {
    const result = await parseCSSFile(filePath);
    results.push(result);
  }

  return results;
}

/**
 * Parse CSS content directly
 */
export function parseContent(content: string, filename?: string): ParseResult {
  return parseCSS(content, filename ?? 'input.css');
}

/**
 * Analyze CSS from various inputs and generate a report
 */
export async function analyze(
  inputs: AnalysisInput[],
  config: AnalyzerConfig = {}
): Promise<Report> {
  const mergedConfig = mergeConfig(config);
  const parseResults: ParseResult[] = [];

  for (const input of inputs) {
    if (input.type === 'file' && input.path) {
      const result = await parseCSSFile(input.path);
      parseResults.push(result);
    } else if (input.type === 'content' && input.content) {
      const result = parseCSS(input.content, input.filename ?? 'input.css');
      parseResults.push(result);
    }
  }

  return generateReport(parseResults, mergedConfig);
}

/**
 * Analyze a directory of CSS files
 */
export async function analyzeDirectory(
  dirPath: string,
  config: AnalyzerConfig = {}
): Promise<Report> {
  const mergedConfig = mergeConfig(config);
  const files = await findCSSFiles(dirPath, mergedConfig);
  const parseResults = await parseFiles(files);

  return generateReport(parseResults, mergedConfig);
}

/**
 * Analyze a single CSS string
 */
export function analyzeCSS(
  css: string,
  config: AnalyzerConfig = {},
  filename?: string
): Report {
  const mergedConfig = mergeConfig(config);
  const parseResult = parseCSS(css, filename ?? 'input.css');

  return generateReport([parseResult], mergedConfig);
}

/**
 * Generate the full report from parse results
 */
export function generateReport(
  parseResults: ParseResult[],
  config: Required<AnalyzerConfig>
): Report {
  // Calculate file metrics
  const fileMetrics: FileMetrics[] = parseResults.map((result) =>
    calculateFileMetrics(result)
  );

  // Calculate global metrics
  const globalMetrics = calculateGlobalMetrics(fileMetrics);

  // Run all rules to find issues
  const issues = runAllRules(parseResults, config);

  // Extract top selectors (worst offenders)
  const topSelectors = extractTopSelectors(parseResults, 10);

  // Generate summary with scores
  const summary = generateSummary(globalMetrics, issues);

  // Generate recommendations
  const recommendations = generateRecommendations(issues);

  return {
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    summary,
    globalMetrics,
    fileMetrics,
    issues,
    topSelectors,
    recommendations,
  };
}

/**
 * Check if the analysis passes the configured thresholds
 */
export function checkThresholds(
  report: Report,
  config: AnalyzerConfig
): { passed: boolean; reasons: string[] } {
  const mergedConfig = mergeConfig(config);
  const reasons: string[] = [];

  // Check overall score
  if (report.summary.overallScore > mergedConfig.maxScore) {
    reasons.push(
      `Overall score (${report.summary.overallScore}) exceeds maximum allowed (${mergedConfig.maxScore})`
    );
  }

  // Check critical issues
  if (report.summary.issuesBySeverity.critical > 0) {
    reasons.push(
      `Found ${report.summary.issuesBySeverity.critical} critical issue(s)`
    );
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

/**
 * Format report as JSON string
 */
export function formatReportAsJSON(report: Report): string {
  return JSON.stringify(report, null, 2);
}
