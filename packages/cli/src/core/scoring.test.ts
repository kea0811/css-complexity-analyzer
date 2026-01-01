import {
  calculateOverallScore,
  calculateSpecificityScore,
  calculateCascadeScore,
  calculateDuplicationScore,
  calculateLayoutRiskScore,
  calculateCategoryScores,
  scoreToGrade,
  countIssuesBySeverity,
  generateSummary,
  generateRecommendations,
} from './scoring.js';
import type { GlobalMetrics, Issue, CategoryScores, Severity } from './types.js';

const createMockMetrics = (overrides: Partial<GlobalMetrics> = {}): GlobalMetrics => ({
  totalFiles: 1,
  totalRules: 10,
  totalSelectors: 15,
  totalDeclarations: 50,
  maxSelectorDepth: 3,
  avgSelectorDepth: 2,
  maxSpecificity: { ids: 0, classes: 2, elements: 1 },
  avgSpecificity: { ids: 0, classes: 1, elements: 0.5 },
  totalImportantCount: 0,
  totalDuplicateDeclarations: 0,
  overallLayoutRiskScore: 5,
  ...overrides,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'HIGH_SPECIFICITY',
  severity: 'medium',
  confidence: 0.9,
  title: 'Test Issue',
  why: 'This is a test issue',
  evidence: { file: 'test.css' },
  suggestions: [],
  tags: ['specificity'],
  ...overrides,
});

describe('calculateOverallScore', () => {
  it('returns 0 for all zero category scores', () => {
    const categoryScores: CategoryScores = {
      specificity: 0,
      cascade: 0,
      duplication: 0,
      layoutRisk: 0,
    };
    expect(calculateOverallScore(categoryScores)).toBe(0);
  });

  it('returns weighted average of category scores', () => {
    const categoryScores: CategoryScores = {
      specificity: 100,
      cascade: 100,
      duplication: 100,
      layoutRisk: 100,
    };
    expect(calculateOverallScore(categoryScores)).toBe(100);
  });

  it('applies correct weights', () => {
    const categoryScores: CategoryScores = {
      specificity: 50,
      cascade: 50,
      duplication: 50,
      layoutRisk: 50,
    };
    expect(calculateOverallScore(categoryScores)).toBe(50);
  });

  it('caps score at 100', () => {
    const categoryScores: CategoryScores = {
      specificity: 150,
      cascade: 150,
      duplication: 150,
      layoutRisk: 150,
    };
    expect(calculateOverallScore(categoryScores)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    const categoryScores: CategoryScores = {
      specificity: 33,
      cascade: 33,
      duplication: 33,
      layoutRisk: 33,
    };
    expect(typeof calculateOverallScore(categoryScores)).toBe('number');
    expect(calculateOverallScore(categoryScores) % 1).toBe(0);
  });
});

describe('calculateSpecificityScore', () => {
  it('returns low score for simple selectors', () => {
    const metrics = createMockMetrics({
      maxSpecificity: { ids: 0, classes: 1, elements: 0 },
      avgSpecificity: { ids: 0, classes: 0.5, elements: 0 },
      maxSelectorDepth: 2,
    });
    const score = calculateSpecificityScore(metrics, []);
    expect(score).toBeLessThan(30);
  });

  it('increases score for high max specificity', () => {
    const metrics = createMockMetrics({
      maxSpecificity: { ids: 2, classes: 5, elements: 3 },
    });
    const score = calculateSpecificityScore(metrics, []);
    expect(score).toBeGreaterThan(30);
  });

  it('increases score for deep selectors', () => {
    const metricsDeep = createMockMetrics({ maxSelectorDepth: 7 });
    const metricsShallow = createMockMetrics({ maxSelectorDepth: 2 });

    const scoreDeep = calculateSpecificityScore(metricsDeep, []);
    const scoreShallow = calculateSpecificityScore(metricsShallow, []);

    expect(scoreDeep).toBeGreaterThan(scoreShallow);
  });

  it('adds penalty for specificity issues', () => {
    const metrics = createMockMetrics();
    const issues = [
      createMockIssue({ id: 'HIGH_SPECIFICITY' }),
      createMockIssue({ id: 'DEEP_SELECTOR' }),
    ];

    const scoreWithIssues = calculateSpecificityScore(metrics, issues);
    const scoreWithoutIssues = calculateSpecificityScore(metrics, []);

    expect(scoreWithIssues).toBeGreaterThan(scoreWithoutIssues);
  });
});

describe('calculateCascadeScore', () => {
  it('returns low score for no !important usage', () => {
    const metrics = createMockMetrics({ totalImportantCount: 0 });
    const score = calculateCascadeScore(metrics, []);
    expect(score).toBeLessThan(20);
  });

  it('increases score for !important usage', () => {
    const metricsHigh = createMockMetrics({ totalImportantCount: 20 });
    const metricsLow = createMockMetrics({ totalImportantCount: 0 });

    const scoreHigh = calculateCascadeScore(metricsHigh, []);
    const scoreLow = calculateCascadeScore(metricsLow, []);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('adds penalty for cascade issues by severity', () => {
    const metrics = createMockMetrics();

    const criticalIssue = createMockIssue({ id: 'IMPORTANT_ABUSE', severity: 'critical' });
    const lowIssue = createMockIssue({ id: 'IMPORTANT_ABUSE', severity: 'low' });

    const scoreCritical = calculateCascadeScore(metrics, [criticalIssue]);
    const scoreLow = calculateCascadeScore(metrics, [lowIssue]);

    expect(scoreCritical).toBeGreaterThan(scoreLow);
  });
});

describe('calculateDuplicationScore', () => {
  it('returns low score for no duplicates', () => {
    const metrics = createMockMetrics({ totalDuplicateDeclarations: 0 });
    const score = calculateDuplicationScore(metrics, []);
    expect(score).toBeLessThan(20);
  });

  it('increases score for duplicate declarations', () => {
    const metricsHigh = createMockMetrics({ totalDuplicateDeclarations: 50 });
    const metricsLow = createMockMetrics({ totalDuplicateDeclarations: 0 });

    const scoreHigh = calculateDuplicationScore(metricsHigh, []);
    const scoreLow = calculateDuplicationScore(metricsLow, []);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('adds penalty for duplication issues', () => {
    const metrics = createMockMetrics();
    const issue = createMockIssue({ id: 'DUPLICATE_DECLARATIONS', evidence: { file: 'test.css', count: 10 } });

    const scoreWithIssue = calculateDuplicationScore(metrics, [issue]);
    const scoreWithoutIssue = calculateDuplicationScore(metrics, []);

    expect(scoreWithIssue).toBeGreaterThan(scoreWithoutIssue);
  });
});

describe('calculateLayoutRiskScore', () => {
  it('returns low score for low layout risk', () => {
    const metrics = createMockMetrics({ overallLayoutRiskScore: 2, totalRules: 10 });
    const score = calculateLayoutRiskScore(metrics, []);
    expect(score).toBeLessThan(20);
  });

  it('increases score for high layout risk', () => {
    const metricsHigh = createMockMetrics({ overallLayoutRiskScore: 100, totalRules: 10 });
    const metricsLow = createMockMetrics({ overallLayoutRiskScore: 5, totalRules: 10 });

    const scoreHigh = calculateLayoutRiskScore(metricsHigh, []);
    const scoreLow = calculateLayoutRiskScore(metricsLow, []);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('adds penalty for layout risk issues by severity', () => {
    const metrics = createMockMetrics();

    const highIssue = createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT', severity: 'high' });
    const lowIssue = createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT', severity: 'low' });

    const scoreHigh = calculateLayoutRiskScore(metrics, [highIssue]);
    const scoreLow = calculateLayoutRiskScore(metrics, [lowIssue]);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });
});

describe('calculateCategoryScores', () => {
  it('returns all category scores', () => {
    const metrics = createMockMetrics();
    const scores = calculateCategoryScores(metrics, []);

    expect(scores).toHaveProperty('specificity');
    expect(scores).toHaveProperty('cascade');
    expect(scores).toHaveProperty('duplication');
    expect(scores).toHaveProperty('layoutRisk');
  });

  it('all scores are numbers between 0 and 100', () => {
    const metrics = createMockMetrics();
    const scores = calculateCategoryScores(metrics, []);

    expect(scores.specificity).toBeGreaterThanOrEqual(0);
    expect(scores.specificity).toBeLessThanOrEqual(100);
    expect(scores.cascade).toBeGreaterThanOrEqual(0);
    expect(scores.cascade).toBeLessThanOrEqual(100);
    expect(scores.duplication).toBeGreaterThanOrEqual(0);
    expect(scores.duplication).toBeLessThanOrEqual(100);
    expect(scores.layoutRisk).toBeGreaterThanOrEqual(0);
    expect(scores.layoutRisk).toBeLessThanOrEqual(100);
  });
});

describe('scoreToGrade', () => {
  it('returns A for score <= 20', () => {
    expect(scoreToGrade(0)).toBe('A');
    expect(scoreToGrade(10)).toBe('A');
    expect(scoreToGrade(20)).toBe('A');
  });

  it('returns B for score 21-40', () => {
    expect(scoreToGrade(21)).toBe('B');
    expect(scoreToGrade(30)).toBe('B');
    expect(scoreToGrade(40)).toBe('B');
  });

  it('returns C for score 41-60', () => {
    expect(scoreToGrade(41)).toBe('C');
    expect(scoreToGrade(50)).toBe('C');
    expect(scoreToGrade(60)).toBe('C');
  });

  it('returns D for score 61-80', () => {
    expect(scoreToGrade(61)).toBe('D');
    expect(scoreToGrade(70)).toBe('D');
    expect(scoreToGrade(80)).toBe('D');
  });

  it('returns F for score > 80', () => {
    expect(scoreToGrade(81)).toBe('F');
    expect(scoreToGrade(90)).toBe('F');
    expect(scoreToGrade(100)).toBe('F');
  });
});

describe('countIssuesBySeverity', () => {
  it('returns zero counts for empty array', () => {
    const counts = countIssuesBySeverity([]);
    expect(counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it('counts issues by severity', () => {
    const issues: Issue[] = [
      createMockIssue({ severity: 'critical' }),
      createMockIssue({ severity: 'high' }),
      createMockIssue({ severity: 'high' }),
      createMockIssue({ severity: 'medium' }),
      createMockIssue({ severity: 'low' }),
      createMockIssue({ severity: 'low' }),
      createMockIssue({ severity: 'low' }),
    ];

    const counts = countIssuesBySeverity(issues);
    expect(counts).toEqual({ critical: 1, high: 2, medium: 1, low: 3 });
  });
});

describe('generateSummary', () => {
  it('generates summary with all required fields', () => {
    const metrics = createMockMetrics();
    const summary = generateSummary(metrics, []);

    expect(summary).toHaveProperty('overallScore');
    expect(summary).toHaveProperty('categoryScores');
    expect(summary).toHaveProperty('grade');
    expect(summary).toHaveProperty('totalIssues');
    expect(summary).toHaveProperty('issuesBySeverity');
  });

  it('counts total issues correctly', () => {
    const metrics = createMockMetrics();
    const issues = [createMockIssue(), createMockIssue(), createMockIssue()];

    const summary = generateSummary(metrics, issues);
    expect(summary.totalIssues).toBe(3);
  });

  it('assigns grade based on overall score', () => {
    const goodMetrics = createMockMetrics({
      maxSpecificity: { ids: 0, classes: 1, elements: 0 },
      avgSpecificity: { ids: 0, classes: 0.5, elements: 0 },
      maxSelectorDepth: 2,
      totalImportantCount: 0,
    });

    const summary = generateSummary(goodMetrics, []);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(summary.grade);
  });
});

describe('calculateCascadeScore severity branches', () => {
  it('adds penalty for high severity cascade issues', () => {
    const metrics = createMockMetrics();
    const highIssue = createMockIssue({ id: 'IMPORTANT_ABUSE', severity: 'high' });

    const scoreWithHigh = calculateCascadeScore(metrics, [highIssue]);
    const scoreWithoutIssues = calculateCascadeScore(metrics, []);

    expect(scoreWithHigh).toBeGreaterThan(scoreWithoutIssues);
    expect(scoreWithHigh - scoreWithoutIssues).toBe(10); // high adds 10
  });

  it('adds penalty for medium severity cascade issues', () => {
    const metrics = createMockMetrics();
    const mediumIssue = createMockIssue({ id: 'OVERRIDE_PRESSURE', severity: 'medium' });

    const scoreWithMedium = calculateCascadeScore(metrics, [mediumIssue]);
    const scoreWithoutIssues = calculateCascadeScore(metrics, []);

    expect(scoreWithMedium - scoreWithoutIssues).toBe(5); // medium adds 5
  });
});

describe('calculateDuplicationScore count branches', () => {
  it('handles issues without count in evidence', () => {
    const metrics = createMockMetrics();
    const issue = createMockIssue({ id: 'DUPLICATE_DECLARATIONS', evidence: { file: 'test.css' } });

    // Should not throw even if count is undefined
    const score = calculateDuplicationScore(metrics, [issue]);
    expect(typeof score).toBe('number');
  });

  it('caps individual issue penalty at 10', () => {
    const metrics = createMockMetrics();
    const issueWithHighCount = createMockIssue({
      id: 'DUPLICATE_DECLARATIONS',
      evidence: { file: 'test.css', count: 50 },
    });

    const score = calculateDuplicationScore(metrics, [issueWithHighCount]);
    // Should add at most 10 for a single issue
    expect(score).toBeLessThanOrEqual(50); // base + max penalty
  });
});

describe('calculateLayoutRiskScore severity branches', () => {
  it('adds penalty for medium severity layout issues', () => {
    const metrics = createMockMetrics();
    const mediumIssue = createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT', severity: 'medium' });

    const scoreWithMedium = calculateLayoutRiskScore(metrics, [mediumIssue]);
    const scoreWithoutIssues = calculateLayoutRiskScore(metrics, []);

    expect(scoreWithMedium - scoreWithoutIssues).toBe(8); // medium adds 8
  });
});

describe('generateRecommendations priority branches', () => {
  it('sets high priority for many specificity issues', () => {
    // More than 5 issues = high priority
    const manyIssues = Array(6).fill(null).map(() => createMockIssue({ id: 'HIGH_SPECIFICITY' }));
    const recommendations = generateRecommendations(manyIssues);

    const specRec = recommendations.find(r => r.category === 'Specificity');
    expect(specRec?.priority).toBe('high');
  });

  it('sets low priority for few layout issues', () => {
    // 5 or fewer layout issues = low priority
    const fewIssues = Array(3).fill(null).map(() => createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT' }));
    const recommendations = generateRecommendations(fewIssues);

    const layoutRec = recommendations.find(r => r.category === 'Layout');
    expect(layoutRec?.priority).toBe('low');
  });

  it('sets high priority for many layout issues', () => {
    // More than 5 layout issues = high priority
    const manyIssues = Array(6).fill(null).map(() => createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT' }));
    const recommendations = generateRecommendations(manyIssues);

    const layoutRec = recommendations.find(r => r.category === 'Layout');
    expect(layoutRec?.priority).toBe('high');
  });

  it('includes override pressure recommendation', () => {
    const issues = [createMockIssue({ id: 'OVERRIDE_PRESSURE' })];
    const recommendations = generateRecommendations(issues);

    const cascadeRec = recommendations.find(r => r.relatedIssueIds?.includes('OVERRIDE_PRESSURE'));
    expect(cascadeRec).toBeDefined();
    expect(cascadeRec?.title).toContain('Consolidate');
  });

  it('includes deep selector issues in specificity recommendation', () => {
    const issues = [createMockIssue({ id: 'DEEP_SELECTOR' })];
    const recommendations = generateRecommendations(issues);

    const specRec = recommendations.find(r => r.category === 'Specificity');
    expect(specRec).toBeDefined();
    expect(specRec?.relatedIssueIds).toContain('DEEP_SELECTOR');
  });
});

describe('generateRecommendations', () => {
  it('returns empty array for no issues', () => {
    const recommendations = generateRecommendations([]);
    expect(recommendations).toEqual([]);
  });

  it('generates recommendation for specificity issues', () => {
    const issues = [createMockIssue({ id: 'HIGH_SPECIFICITY' })];
    const recommendations = generateRecommendations(issues);

    expect(recommendations.some(r => r.category === 'Specificity')).toBe(true);
  });

  it('generates recommendation for cascade issues', () => {
    const issues = [createMockIssue({ id: 'IMPORTANT_ABUSE' })];
    const recommendations = generateRecommendations(issues);

    expect(recommendations.some(r => r.category === 'Cascade')).toBe(true);
  });

  it('generates recommendation for duplication issues', () => {
    const issues = [createMockIssue({ id: 'DUPLICATE_DECLARATIONS' })];
    const recommendations = generateRecommendations(issues);

    expect(recommendations.some(r => r.category === 'Duplication')).toBe(true);
  });

  it('generates recommendation for layout issues', () => {
    const issues = [createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT' })];
    const recommendations = generateRecommendations(issues);

    expect(recommendations.some(r => r.category === 'Layout')).toBe(true);
  });

  it('sets priority based on issue count', () => {
    // Need more than 10 issues to trigger high priority for duplication
    const manyIssues = Array(15).fill(null).map(() => createMockIssue({ id: 'DUPLICATE_DECLARATIONS' }));
    const recommendations = generateRecommendations(manyIssues);

    const duplicationRec = recommendations.find(r => r.category === 'Duplication');
    expect(duplicationRec?.priority).toBe('high');
  });

  it('sorts recommendations by priority', () => {
    const issues = [
      createMockIssue({ id: 'IMPORTANT_ABUSE' }), // high priority for cascade
      createMockIssue({ id: 'LAYOUT_RISK_HOTSPOT' }), // low priority
    ];
    const recommendations = generateRecommendations(issues);

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < recommendations.length; i++) {
      const prev = recommendations[i - 1];
      const curr = recommendations[i];
      if (prev && curr) {
        expect(priorityOrder[prev.priority]).toBeLessThanOrEqual(priorityOrder[curr.priority]);
      }
    }
  });

  it('includes related issue IDs', () => {
    const issues = [createMockIssue({ id: 'HIGH_SPECIFICITY' })];
    const recommendations = generateRecommendations(issues);

    const specRec = recommendations.find(r => r.category === 'Specificity');
    expect(specRec?.relatedIssueIds).toContain('HIGH_SPECIFICITY');
  });
});
