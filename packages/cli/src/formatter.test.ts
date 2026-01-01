import {
  formatSeverity,
  formatGrade,
  formatScore,
  formatSummary,
  formatIssue,
  formatIssues,
  formatTopSelector,
  formatTopSelectors,
  formatRecommendation,
  formatRecommendations,
  formatNextSteps,
  formatReport,
  formatCheckResult,
} from './formatter.js';
import type { Summary, Issue, TopSelector, Recommendation, Report } from './core/index.js';

// Strip ANSI codes for testing
const stripAnsi = (str: string): string => str.replace(/\x1B\[[0-9;]*m/g, '');

describe('formatSeverity', () => {
  it('formats critical severity', () => {
    const result = stripAnsi(formatSeverity('critical'));
    expect(result).toContain('CRITICAL');
  });

  it('formats high severity', () => {
    const result = stripAnsi(formatSeverity('high'));
    expect(result).toContain('HIGH');
  });

  it('formats medium severity', () => {
    const result = stripAnsi(formatSeverity('medium'));
    expect(result).toContain('MEDIUM');
  });

  it('formats low severity', () => {
    const result = stripAnsi(formatSeverity('low'));
    expect(result).toContain('LOW');
  });
});

describe('formatGrade', () => {
  it('formats all grades', () => {
    expect(stripAnsi(formatGrade('A'))).toBe('A');
    expect(stripAnsi(formatGrade('B'))).toBe('B');
    expect(stripAnsi(formatGrade('C'))).toBe('C');
    expect(stripAnsi(formatGrade('D'))).toBe('D');
    expect(stripAnsi(formatGrade('F'))).toBe('F');
  });

  it('returns unchanged for unknown grade', () => {
    expect(formatGrade('X')).toBe('X');
  });
});

describe('formatScore', () => {
  it('formats scores as strings', () => {
    expect(stripAnsi(formatScore(0))).toBe('0');
    expect(stripAnsi(formatScore(50))).toBe('50');
    expect(stripAnsi(formatScore(100))).toBe('100');
  });
});

describe('formatSummary', () => {
  const mockSummary: Summary = {
    overallScore: 45,
    categoryScores: {
      specificity: 40,
      cascade: 50,
      duplication: 30,
      layoutRisk: 60,
    },
    grade: 'C',
    totalIssues: 10,
    issuesBySeverity: { critical: 1, high: 2, medium: 3, low: 4 },
  };

  it('includes header', () => {
    const result = formatSummary(mockSummary);
    expect(result).toContain('CSS COMPLEXITY REPORT');
  });

  it('includes grade', () => {
    const result = stripAnsi(formatSummary(mockSummary));
    expect(result).toContain('C');
  });

  it('includes overall score', () => {
    const result = stripAnsi(formatSummary(mockSummary));
    expect(result).toContain('45');
  });

  it('includes category scores', () => {
    const result = stripAnsi(formatSummary(mockSummary));
    expect(result).toContain('Specificity');
    expect(result).toContain('Cascade');
    expect(result).toContain('Duplication');
    expect(result).toContain('Layout Risk');
  });

  it('includes issue counts by severity', () => {
    const result = stripAnsi(formatSummary(mockSummary));
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
    expect(result).toContain('4');
  });
});

describe('formatIssue', () => {
  const mockIssue: Issue = {
    id: 'HIGH_SPECIFICITY',
    severity: 'high',
    confidence: 0.9,
    title: 'High specificity selector',
    why: 'This selector has high specificity making it hard to override',
    evidence: {
      file: 'test.css',
      selector: '#main .content',
      line: 10,
    },
    suggestions: [{ action: 'Flatten', description: 'Flatten the selector' }],
    tags: ['specificity'],
  };

  it('includes severity', () => {
    const result = stripAnsi(formatIssue(mockIssue, 0));
    expect(result).toContain('HIGH');
  });

  it('includes title', () => {
    const result = formatIssue(mockIssue, 0);
    expect(result).toContain('High specificity selector');
  });

  it('includes file location', () => {
    const result = formatIssue(mockIssue, 0);
    expect(result).toContain('test.css');
    expect(result).toContain('10');
  });

  it('includes selector', () => {
    const result = formatIssue(mockIssue, 0);
    expect(result).toContain('#main .content');
  });

  it('includes index number', () => {
    const result = formatIssue(mockIssue, 5);
    expect(result).toContain('6.');
  });
});

describe('formatIssues', () => {
  const mockIssues: Issue[] = Array(15)
    .fill(null)
    .map((_, i) => ({
      id: 'HIGH_SPECIFICITY' as const,
      severity: 'medium' as const,
      confidence: 0.9,
      title: `Issue ${i + 1}`,
      why: 'Test issue',
      evidence: { file: 'test.css' },
      suggestions: [],
      tags: ['specificity' as const],
    }));

  it('includes header', () => {
    const result = formatIssues(mockIssues);
    expect(result).toContain('TOP ISSUES');
  });

  it('respects limit parameter', () => {
    const result = formatIssues(mockIssues, 5);
    expect(result).toContain('Issue 1');
    expect(result).toContain('Issue 5');
    expect(result).not.toContain('Issue 6');
  });

  it('shows remaining count when exceeding limit', () => {
    const result = formatIssues(mockIssues, 10);
    expect(result).toContain('5 more issues');
  });

  it('shows all issues when under limit', () => {
    const fewIssues = mockIssues.slice(0, 3);
    const result = formatIssues(fewIssues, 10);
    expect(result).not.toContain('more issues');
  });
});

describe('formatTopSelector', () => {
  const mockSelector: TopSelector = {
    selector: '.page .main .content',
    file: 'styles.css',
    line: 25,
    specificity: { ids: 0, classes: 3, elements: 0 },
    depth: 3,
    score: 39,
  };

  it('includes selector', () => {
    const result = formatTopSelector(mockSelector, 0);
    expect(result).toContain('.page .main .content');
  });

  it('includes file and line', () => {
    const result = formatTopSelector(mockSelector, 0);
    expect(result).toContain('styles.css');
    expect(result).toContain('25');
  });

  it('includes specificity', () => {
    const result = formatTopSelector(mockSelector, 0);
    expect(result).toContain('[0,3,0]');
  });

  it('includes depth', () => {
    const result = formatTopSelector(mockSelector, 0);
    expect(result).toContain('Depth: 3');
  });

  it('truncates long selectors', () => {
    const longSelector: TopSelector = {
      ...mockSelector,
      selector: '.a .b .c .d .e .f .g .h .i .j .k .l .m .n .o .p .q .r .s .t',
    };
    const result = formatTopSelector(longSelector, 0);
    expect(result).toContain('...');
  });
});

describe('formatTopSelectors', () => {
  const mockSelectors: TopSelector[] = Array(10)
    .fill(null)
    .map((_, i) => ({
      selector: `.selector-${i + 1}`,
      file: 'test.css',
      line: i + 1,
      specificity: { ids: 0, classes: 1, elements: 0 },
      depth: 1,
      score: 10 - i,
    }));

  it('includes header', () => {
    const result = formatTopSelectors(mockSelectors);
    expect(result).toContain('WORST SELECTORS');
  });

  it('respects limit parameter', () => {
    const result = formatTopSelectors(mockSelectors, 3);
    expect(result).toContain('.selector-1');
    expect(result).toContain('.selector-3');
    expect(result).not.toContain('.selector-4');
  });
});

describe('formatRecommendation', () => {
  const mockRec: Recommendation = {
    category: 'Specificity',
    title: 'Reduce selector complexity',
    description: 'Consider using simpler selectors',
    priority: 'high',
    relatedIssueIds: ['HIGH_SPECIFICITY', 'DEEP_SELECTOR'],
  };

  it('includes priority', () => {
    const result = stripAnsi(formatRecommendation(mockRec, 0));
    expect(result).toContain('HIGH');
  });

  it('includes title', () => {
    const result = formatRecommendation(mockRec, 0);
    expect(result).toContain('Reduce selector complexity');
  });

  it('includes description', () => {
    const result = formatRecommendation(mockRec, 0);
    expect(result).toContain('Consider using simpler selectors');
  });
});

describe('formatRecommendations', () => {
  const mockRecs: Recommendation[] = [
    {
      category: 'Specificity',
      title: 'Reduce complexity',
      description: 'Use simpler selectors',
      priority: 'high',
      relatedIssueIds: [],
    },
    {
      category: 'Cascade',
      title: 'Reduce !important',
      description: 'Avoid !important',
      priority: 'medium',
      relatedIssueIds: [],
    },
  ];

  it('includes header', () => {
    const result = formatRecommendations(mockRecs);
    expect(result).toContain('RECOMMENDATIONS');
  });

  it('includes all recommendations', () => {
    const result = formatRecommendations(mockRecs);
    expect(result).toContain('Reduce complexity');
    expect(result).toContain('Reduce !important');
  });
});

describe('formatNextSteps', () => {
  it('includes next steps', () => {
    const result = formatNextSteps();
    expect(result).toContain('NEXT STEPS');
  });

  it('includes actionable advice', () => {
    const result = formatNextSteps();
    expect(result).toContain('critical');
    expect(result).toContain('CI');
  });
});

describe('formatReport', () => {
  const mockReport: Report = {
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    summary: {
      overallScore: 45,
      categoryScores: { specificity: 40, cascade: 50, duplication: 30, layoutRisk: 60 },
      grade: 'C',
      totalIssues: 2,
      issuesBySeverity: { critical: 0, high: 1, medium: 1, low: 0 },
    },
    globalMetrics: {
      totalFiles: 1,
      totalRules: 10,
      totalSelectors: 15,
      totalDeclarations: 50,
      maxSelectorDepth: 3,
      avgSelectorDepth: 2,
      maxSpecificity: { ids: 1, classes: 2, elements: 1 },
      avgSpecificity: { ids: 0, classes: 1, elements: 0.5 },
      totalImportantCount: 2,
      totalDuplicateDeclarations: 5,
      overallLayoutRiskScore: 10,
    },
    fileMetrics: [],
    issues: [
      {
        id: 'HIGH_SPECIFICITY',
        severity: 'high',
        confidence: 0.9,
        title: 'Test issue',
        why: 'Test reason',
        evidence: { file: 'test.css' },
        suggestions: [],
        tags: ['specificity'],
      },
    ],
    topSelectors: [
      {
        selector: '.test',
        file: 'test.css',
        line: 1,
        specificity: { ids: 0, classes: 1, elements: 0 },
        depth: 1,
        score: 10,
      },
    ],
    recommendations: [
      {
        category: 'Specificity',
        title: 'Test rec',
        description: 'Test description',
        priority: 'medium',
        relatedIssueIds: [],
      },
    ],
  };

  it('includes all sections', () => {
    const result = formatReport(mockReport);
    expect(result).toContain('CSS COMPLEXITY REPORT');
    expect(result).toContain('TOP ISSUES');
    expect(result).toContain('WORST SELECTORS');
    expect(result).toContain('RECOMMENDATIONS');
    expect(result).toContain('NEXT STEPS');
  });

  it('returns empty string when silent', () => {
    const result = formatReport(mockReport, { silent: true });
    expect(result).toBe('');
  });
});

describe('formatCheckResult', () => {
  it('formats passing result', () => {
    const result = stripAnsi(formatCheckResult(true, [], 30));
    expect(result).toContain('PASSED');
    expect(result).toContain('30');
  });

  it('formats failing result', () => {
    const result = stripAnsi(formatCheckResult(false, ['Score too high'], 80));
    expect(result).toContain('FAILED');
    expect(result).toContain('80');
    expect(result).toContain('Score too high');
  });

  it('lists all failure reasons', () => {
    const reasons = ['Reason 1', 'Reason 2', 'Reason 3'];
    const result = formatCheckResult(false, reasons, 80);
    expect(result).toContain('Reason 1');
    expect(result).toContain('Reason 2');
    expect(result).toContain('Reason 3');
  });
});
