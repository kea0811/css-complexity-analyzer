import {
  mergeConfig,
  parseContent,
  analyzeCSS,
  generateReport,
  checkThresholds,
  formatReportAsJSON,
  findCSSFiles,
  parseFiles,
  analyze,
  analyzeDirectory,
} from './analyzer.js';
import * as path from 'path';
import { parseCSS } from './parser.js';
import type { AnalyzerConfig, Report } from './types.js';

describe('mergeConfig', () => {
  it('returns default config when no user config provided', () => {
    const config = mergeConfig();

    expect(config.include).toEqual(['**/*.css']);
    expect(config.exclude).toContain('**/node_modules/**');
    expect(config.thresholds.maxSelectorDepth).toBe(4);
    expect(config.maxScore).toBe(100);
  });

  it('overrides include patterns', () => {
    const config = mergeConfig({ include: ['src/**/*.css'] });
    expect(config.include).toEqual(['src/**/*.css']);
  });

  it('overrides exclude patterns', () => {
    const config = mergeConfig({ exclude: ['test/**'] });
    expect(config.exclude).toEqual(['test/**']);
  });

  it('merges thresholds with defaults', () => {
    const config = mergeConfig({
      thresholds: { maxSelectorDepth: 6 },
    });

    expect(config.thresholds.maxSelectorDepth).toBe(6);
    expect(config.thresholds.maxSpecificityScore).toBe(40); // default
  });

  it('merges rules with defaults', () => {
    const config = mergeConfig({
      rules: { deepSelectors: false },
    });

    expect(config.rules.deepSelectors).toBe(false);
    expect(config.rules.highSpecificity).toBe(true); // default
  });

  it('overrides maxScore', () => {
    const config = mergeConfig({ maxScore: 50 });
    expect(config.maxScore).toBe(50);
  });

  it('overrides ignorePatterns', () => {
    const config = mergeConfig({ ignorePatterns: ['*.min.css'] });
    expect(config.ignorePatterns).toEqual(['*.min.css']);
  });
});

describe('parseContent', () => {
  it('parses CSS content with default filename', () => {
    const result = parseContent('.button { color: red; }');

    expect(result.file).toBe('input.css');
    expect(result.rules).toHaveLength(1);
  });

  it('parses CSS content with custom filename', () => {
    const result = parseContent('.button { color: red; }', 'custom.css');

    expect(result.file).toBe('custom.css');
  });
});

describe('analyzeCSS', () => {
  it('generates report from CSS string', () => {
    const css = '.button { color: red; }';
    const report = analyzeCSS(css);

    expect(report).toHaveProperty('version');
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('globalMetrics');
    expect(report).toHaveProperty('fileMetrics');
    expect(report).toHaveProperty('issues');
    expect(report).toHaveProperty('topSelectors');
    expect(report).toHaveProperty('recommendations');
  });

  it('uses custom config', () => {
    const css = '.a .b .c { color: red; }';
    const config: AnalyzerConfig = {
      thresholds: { maxSelectorDepth: 2 },
    };
    const report = analyzeCSS(css, config);

    // Should detect deep selector with lower threshold
    expect(report.issues.some(i => i.id === 'DEEP_SELECTOR')).toBe(true);
  });

  it('uses custom filename', () => {
    const css = '.button { color: red; }';
    const report = analyzeCSS(css, {}, 'custom.css');

    expect(report.fileMetrics[0]?.file).toBe('custom.css');
  });

  it('calculates correct metrics', () => {
    const css = `
      .button { color: red; padding: 10px; }
      .card { background: white; }
    `;
    const report = analyzeCSS(css);

    expect(report.globalMetrics.totalRules).toBe(2);
    expect(report.globalMetrics.totalSelectors).toBe(2);
    expect(report.globalMetrics.totalDeclarations).toBe(3);
  });

  it('detects issues', () => {
    const css = '#main #content .wrapper .inner .text { color: red !important; }';
    const report = analyzeCSS(css);

    expect(report.issues.length).toBeGreaterThan(0);
  });

  it('extracts top selectors', () => {
    const css = `
      #main .content { color: red; }
      .simple { color: blue; }
    `;
    const report = analyzeCSS(css);

    expect(report.topSelectors.length).toBeGreaterThan(0);
    // Higher specificity selector should be first
    expect(report.topSelectors[0]?.selector).toBe('#main .content');
  });

  it('generates recommendations based on issues', () => {
    const css = `
      #main { color: red; }
      .button { color: blue !important; }
      .card { color: green !important; }
      .modal { color: yellow !important; }
      .alert { color: purple !important; }
      .toast { color: orange !important; }
    `;
    const report = analyzeCSS(css);

    // Should have recommendations for the issues
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

describe('generateReport', () => {
  it('generates complete report structure', () => {
    const css = '.button { color: red; }';
    const parseResult = parseCSS(css, 'test.css');
    const config = mergeConfig({});
    const report = generateReport([parseResult], config);

    expect(report.version).toBe('0.1.0');
    expect(typeof report.timestamp).toBe('string');
    expect(report.summary).toBeDefined();
    expect(report.globalMetrics).toBeDefined();
    expect(Array.isArray(report.fileMetrics)).toBe(true);
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.topSelectors)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('includes file metrics for each parsed file', () => {
    const css1 = '.button { color: red; }';
    const css2 = '.card { background: white; }';
    const result1 = parseCSS(css1, 'file1.css');
    const result2 = parseCSS(css2, 'file2.css');
    const config = mergeConfig({});
    const report = generateReport([result1, result2], config);

    expect(report.fileMetrics).toHaveLength(2);
    expect(report.fileMetrics[0]?.file).toBe('file1.css');
    expect(report.fileMetrics[1]?.file).toBe('file2.css');
  });

  it('aggregates global metrics correctly', () => {
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
    `;
    const parseResult = parseCSS(css);
    const config = mergeConfig({});
    const report = generateReport([parseResult], config);

    expect(report.globalMetrics.totalFiles).toBe(1);
    expect(report.globalMetrics.totalRules).toBe(3);
    expect(report.globalMetrics.totalSelectors).toBe(3);
  });
});

describe('checkThresholds', () => {
  it('passes when score is below max', () => {
    const report: Report = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      summary: {
        overallScore: 30,
        categoryScores: { specificity: 20, cascade: 20, duplication: 20, layoutRisk: 20 },
        grade: 'B',
        totalIssues: 0,
        issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      globalMetrics: {
        totalFiles: 1,
        totalRules: 1,
        totalSelectors: 1,
        totalDeclarations: 1,
        maxSelectorDepth: 1,
        avgSelectorDepth: 1,
        maxSpecificity: { ids: 0, classes: 1, elements: 0 },
        avgSpecificity: { ids: 0, classes: 1, elements: 0 },
        totalImportantCount: 0,
        totalDuplicateDeclarations: 0,
        overallLayoutRiskScore: 0,
      },
      fileMetrics: [],
      issues: [],
      topSelectors: [],
      recommendations: [],
    };

    const result = checkThresholds(report, { maxScore: 60 });
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('fails when score exceeds max', () => {
    const report: Report = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      summary: {
        overallScore: 80,
        categoryScores: { specificity: 80, cascade: 80, duplication: 80, layoutRisk: 80 },
        grade: 'D',
        totalIssues: 0,
        issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      globalMetrics: {
        totalFiles: 1,
        totalRules: 1,
        totalSelectors: 1,
        totalDeclarations: 1,
        maxSelectorDepth: 1,
        avgSelectorDepth: 1,
        maxSpecificity: { ids: 0, classes: 1, elements: 0 },
        avgSpecificity: { ids: 0, classes: 1, elements: 0 },
        totalImportantCount: 0,
        totalDuplicateDeclarations: 0,
        overallLayoutRiskScore: 0,
      },
      fileMetrics: [],
      issues: [],
      topSelectors: [],
      recommendations: [],
    };

    const result = checkThresholds(report, { maxScore: 60 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('exceeds'))).toBe(true);
  });

  it('fails when critical issues exist', () => {
    const report: Report = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      summary: {
        overallScore: 30,
        categoryScores: { specificity: 30, cascade: 30, duplication: 30, layoutRisk: 30 },
        grade: 'B',
        totalIssues: 1,
        issuesBySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
      },
      globalMetrics: {
        totalFiles: 1,
        totalRules: 1,
        totalSelectors: 1,
        totalDeclarations: 1,
        maxSelectorDepth: 1,
        avgSelectorDepth: 1,
        maxSpecificity: { ids: 0, classes: 1, elements: 0 },
        avgSpecificity: { ids: 0, classes: 1, elements: 0 },
        totalImportantCount: 0,
        totalDuplicateDeclarations: 0,
        overallLayoutRiskScore: 0,
      },
      fileMetrics: [],
      issues: [],
      topSelectors: [],
      recommendations: [],
    };

    const result = checkThresholds(report, { maxScore: 60 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('critical'))).toBe(true);
  });

  it('uses default maxScore when not specified', () => {
    const report: Report = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      summary: {
        overallScore: 90,
        categoryScores: { specificity: 90, cascade: 90, duplication: 90, layoutRisk: 90 },
        grade: 'F',
        totalIssues: 0,
        issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      globalMetrics: {
        totalFiles: 1,
        totalRules: 1,
        totalSelectors: 1,
        totalDeclarations: 1,
        maxSelectorDepth: 1,
        avgSelectorDepth: 1,
        maxSpecificity: { ids: 0, classes: 1, elements: 0 },
        avgSpecificity: { ids: 0, classes: 1, elements: 0 },
        totalImportantCount: 0,
        totalDuplicateDeclarations: 0,
        overallLayoutRiskScore: 0,
      },
      fileMetrics: [],
      issues: [],
      topSelectors: [],
      recommendations: [],
    };

    // Default maxScore is 100, so 90 should pass
    const result = checkThresholds(report, {});
    expect(result.passed).toBe(true);
  });
});

describe('formatReportAsJSON', () => {
  it('returns valid JSON string', () => {
    const css = '.button { color: red; }';
    const report = analyzeCSS(css);
    const json = formatReportAsJSON(report);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('preserves all report properties', () => {
    const css = '.button { color: red; }';
    const report = analyzeCSS(css);
    const json = formatReportAsJSON(report);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(report.version);
    expect(parsed.summary.overallScore).toBe(report.summary.overallScore);
    expect(parsed.globalMetrics.totalRules).toBe(report.globalMetrics.totalRules);
  });

  it('formats with proper indentation', () => {
    const css = '.button { color: red; }';
    const report = analyzeCSS(css);
    const json = formatReportAsJSON(report);

    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indentation
  });
});

describe('findCSSFiles', () => {
  it('finds CSS files in examples directory', async () => {
    const examplesDir = path.resolve(__dirname, '../../examples');
    const config = mergeConfig({ include: ['**/*.css'] });
    const files = await findCSSFiles(examplesDir, config);

    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.endsWith('.css'))).toBe(true);
  });

  it('returns empty array for non-existent directory pattern', async () => {
    const config = mergeConfig({ include: ['nonexistent/**/*.css'] });
    const files = await findCSSFiles('/tmp/nonexistent-dir-12345', config);

    expect(files).toEqual([]);
  });
});

describe('findCSSFiles edge cases', () => {
  it('handles invalid glob pattern gracefully', async () => {
    // Test with a pattern that might cause glob to throw
    const config = mergeConfig({ include: ['[invalid-pattern'] });
    const files = await findCSSFiles('/tmp', config);

    // Should handle gracefully without throwing
    expect(Array.isArray(files)).toBe(true);
  });

  it('handles literal path that does not exist', async () => {
    // A pattern that's not a glob but a literal path that doesn't exist
    const config = mergeConfig({ include: ['specific-file-that-does-not-exist.css'] });
    const files = await findCSSFiles('/tmp/nonexistent-dir-xyz', config);

    expect(files).toEqual([]);
  });
});

describe('parseFiles', () => {
  it('parses multiple files', async () => {
    const examplesDir = path.resolve(__dirname, '../../examples');
    const config = mergeConfig({});
    const files = await findCSSFiles(examplesDir, config);

    if (files.length > 0) {
      const results = await parseFiles(files);
      expect(results.length).toBe(files.length);
    }
  });

  it('returns empty array for empty input', async () => {
    const results = await parseFiles([]);
    expect(results).toEqual([]);
  });
});

describe('analyze', () => {
  it('analyzes content inputs', async () => {
    const report = await analyze([
      { type: 'content', content: '.a { color: red; }' },
      { type: 'content', content: '.b { color: blue; }', filename: 'custom.css' },
    ]);

    expect(report.globalMetrics.totalFiles).toBe(2);
    expect(report.globalMetrics.totalRules).toBe(2);
  });

  it('handles file inputs with non-existent files gracefully', async () => {
    const report = await analyze([
      { type: 'file', path: '/nonexistent/file.css' },
    ]);

    expect(report).toBeDefined();
    expect(report.globalMetrics.totalRules).toBe(0);
  });

  it('skips invalid input types', async () => {
    const report = await analyze([
      { type: 'content' }, // missing content
      { type: 'file' }, // missing path
    ]);

    expect(report.globalMetrics.totalFiles).toBe(0);
  });
});

describe('analyzeDirectory', () => {
  it('analyzes examples directory', async () => {
    const examplesDir = path.resolve(__dirname, '../../examples');
    const report = await analyzeDirectory(examplesDir);

    expect(report.globalMetrics.totalFiles).toBeGreaterThan(0);
    expect(report.fileMetrics.length).toBeGreaterThan(0);
  });

  it('returns empty results for non-existent directory', async () => {
    const report = await analyzeDirectory('/nonexistent/dir/12345');

    expect(report.globalMetrics.totalFiles).toBe(0);
    expect(report.issues).toEqual([]);
  });
});
