import { analyzeCSS } from './analyzer.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Fixture-based tests', () => {
  const fixturesPath = path.resolve(__dirname, '../../examples');

  describe('fixture-simple', () => {
    it('should have low complexity for simple CSS', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-simple/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Simple CSS should have low score
      expect(report.summary.overallScore).toBeLessThan(30);
      expect(report.summary.grade).toMatch(/^[AB]$/);

      // Should have no high/critical issues
      const highSeverityIssues = report.issues.filter(
        (i) => i.severity === 'high' || i.severity === 'critical'
      );
      expect(highSeverityIssues.length).toBe(0);
    });

    it('should detect basic selectors correctly', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-simple/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have rules parsed
      expect(report.globalMetrics.totalRules).toBeGreaterThan(0);
      expect(report.globalMetrics.totalSelectors).toBeGreaterThan(0);

      // No deep selectors
      expect(report.globalMetrics.maxSelectorDepth).toBeLessThanOrEqual(2);
    });
  });

  describe('fixture-specificity-war', () => {
    it('should detect high complexity for specificity war CSS', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-specificity-war/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have high score due to specificity issues
      expect(report.summary.overallScore).toBeGreaterThan(40);

      // Should detect issues
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should detect ID selectors', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-specificity-war/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have HIGH_SPECIFICITY issues
      const specificityIssues = report.issues.filter((i) => i.id === 'HIGH_SPECIFICITY');
      expect(specificityIssues.length).toBeGreaterThan(0);
    });

    it('should detect deep selectors', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-specificity-war/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have DEEP_SELECTOR issues
      const deepSelectorIssues = report.issues.filter((i) => i.id === 'DEEP_SELECTOR');
      expect(deepSelectorIssues.length).toBeGreaterThan(0);
    });

    it('should detect !important abuse', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-specificity-war/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have IMPORTANT_ABUSE issues
      const importantIssues = report.issues.filter((i) => i.id === 'IMPORTANT_ABUSE');
      expect(importantIssues.length).toBeGreaterThan(0);
    });

    it('should detect override pressure', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-specificity-war/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have OVERRIDE_PRESSURE issues for 'color' property
      const overrideIssues = report.issues.filter((i) => i.id === 'OVERRIDE_PRESSURE');
      expect(overrideIssues.length).toBeGreaterThan(0);
    });
  });

  describe('fixture-duplicates', () => {
    it('should detect duplicate declarations', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-duplicates/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have DUPLICATE_DECLARATIONS issues
      const duplicateIssues = report.issues.filter((i) => i.id === 'DUPLICATE_DECLARATIONS');
      expect(duplicateIssues.length).toBeGreaterThan(0);
    });

    it('should detect repeated display: flex pattern', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-duplicates/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should detect display: flex duplication
      const displayFlexIssue = report.issues.find(
        (i) => i.id === 'DUPLICATE_DECLARATIONS' && i.evidence.property === 'display'
      );
      expect(displayFlexIssue).toBeDefined();
      expect(displayFlexIssue?.evidence.count).toBeGreaterThanOrEqual(5);
    });

    it('should detect repeated margin: 0 auto pattern', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-duplicates/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should detect margin: 0 auto duplication
      const marginIssue = report.issues.find(
        (i) => i.id === 'DUPLICATE_DECLARATIONS' && i.evidence.property === 'margin'
      );
      expect(marginIssue).toBeDefined();
      expect(marginIssue?.evidence.count).toBeGreaterThanOrEqual(4);
    });

    it('should provide utility class suggestions', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-duplicates/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      // Should have suggestions for duplicates
      const duplicateIssues = report.issues.filter((i) => i.id === 'DUPLICATE_DECLARATIONS');
      expect(duplicateIssues.length).toBeGreaterThan(0);

      const hasUtilitySuggestion = duplicateIssues.some((issue) =>
        issue.suggestions.some((s) => s.action.includes('utility'))
      );
      expect(hasUtilitySuggestion).toBe(true);
    });
  });

  describe('Report structure validation', () => {
    it('should have consistent report structure across fixtures', async () => {
      const fixtures = ['fixture-simple', 'fixture-specificity-war', 'fixture-duplicates'];

      for (const fixture of fixtures) {
        const cssPath = path.join(fixturesPath, `${fixture}/styles.css`);
        const css = await fs.readFile(cssPath, 'utf-8');
        const report = analyzeCSS(css);

        // Validate report structure
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('issues');
        expect(report).toHaveProperty('globalMetrics');
        expect(report).toHaveProperty('fileMetrics');
        expect(report).toHaveProperty('topSelectors');
        expect(report).toHaveProperty('recommendations');

        // Validate summary structure
        expect(report.summary).toHaveProperty('overallScore');
        expect(report.summary).toHaveProperty('grade');
        expect(report.summary).toHaveProperty('categoryScores');

        // Validate score ranges
        expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
        expect(report.summary.overallScore).toBeLessThanOrEqual(100);
        expect(['A', 'B', 'C', 'D', 'F']).toContain(report.summary.grade);

        // Validate category scores
        expect(report.summary.categoryScores).toHaveProperty('specificity');
        expect(report.summary.categoryScores).toHaveProperty('cascade');
        expect(report.summary.categoryScores).toHaveProperty('duplication');
        expect(report.summary.categoryScores).toHaveProperty('layoutRisk');
      }
    });

    it('should have valid issue structure', async () => {
      const cssPath = path.join(fixturesPath, 'fixture-specificity-war/styles.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      const report = analyzeCSS(css);

      for (const issue of report.issues) {
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('confidence');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('why');
        expect(issue).toHaveProperty('evidence');
        expect(issue).toHaveProperty('suggestions');
        expect(issue).toHaveProperty('tags');

        // Validate severity
        expect(['low', 'medium', 'high', 'critical']).toContain(issue.severity);

        // Validate confidence
        expect(issue.confidence).toBeGreaterThanOrEqual(0);
        expect(issue.confidence).toBeLessThanOrEqual(1);

        // Validate suggestions array
        expect(Array.isArray(issue.suggestions)).toBe(true);
        for (const suggestion of issue.suggestions) {
          expect(suggestion).toHaveProperty('action');
          expect(suggestion).toHaveProperty('description');
        }
      }
    });
  });
});
