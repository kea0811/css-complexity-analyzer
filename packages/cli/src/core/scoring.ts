import type {
  Summary,
  CategoryScores,
  GlobalMetrics,
  Issue,
  Recommendation,
  Severity,
} from './types.js';
import { specificityToScore } from './parser.js';

/**
 * Calculate the overall score from category scores
 * Score is 0-100 where higher = worse
 */
export function calculateOverallScore(categoryScores: CategoryScores): number {
  // Weighted average of category scores
  const weights = {
    specificity: 0.3,
    cascade: 0.25,
    duplication: 0.2,
    layoutRisk: 0.25,
  };

  const weightedSum =
    categoryScores.specificity * weights.specificity +
    categoryScores.cascade * weights.cascade +
    categoryScores.duplication * weights.duplication +
    categoryScores.layoutRisk * weights.layoutRisk;

  return Math.round(Math.min(100, Math.max(0, weightedSum)));
}

/**
 * Calculate specificity category score from metrics and issues
 */
export function calculateSpecificityScore(
  metrics: GlobalMetrics,
  issues: Issue[]
): number {
  let score = 0;

  // Base score from average specificity
  const avgSpecScore = specificityToScore(metrics.avgSpecificity);
  score += Math.min(30, avgSpecScore);

  // Penalty for max specificity
  const maxSpecScore = specificityToScore(metrics.maxSpecificity);
  if (maxSpecScore > 100) {
    score += 20;
  } else if (maxSpecScore > 50) {
    score += 10;
  }

  // Penalty for deep selectors
  if (metrics.maxSelectorDepth > 6) {
    score += 20;
  } else if (metrics.maxSelectorDepth > 4) {
    score += 10;
  }

  // Penalty from issues
  const specificityIssues = issues.filter(
    (i) => i.id === 'HIGH_SPECIFICITY' || i.id === 'DEEP_SELECTOR'
  );
  score += specificityIssues.length * 2;

  return Math.min(100, score);
}

/**
 * Calculate cascade category score from metrics and issues
 */
export function calculateCascadeScore(
  metrics: GlobalMetrics,
  issues: Issue[]
): number {
  let score = 0;

  // Penalty for !important usage
  const importantRatio = metrics.totalImportantCount / Math.max(1, metrics.totalDeclarations);
  score += Math.min(40, importantRatio * 500);

  // Penalty from cascade-related issues
  const cascadeIssues = issues.filter(
    (i) => i.id === 'IMPORTANT_ABUSE' || i.id === 'OVERRIDE_PRESSURE'
  );

  for (const issue of cascadeIssues) {
    if (issue.severity === 'critical') score += 15;
    else if (issue.severity === 'high') score += 10;
    else if (issue.severity === 'medium') score += 5;
    else score += 2;
  }

  return Math.min(100, score);
}

/**
 * Calculate duplication category score from metrics and issues
 */
export function calculateDuplicationScore(
  metrics: GlobalMetrics,
  issues: Issue[]
): number {
  let score = 0;

  // Base score from duplicate count
  const duplicateRatio = metrics.totalDuplicateDeclarations / Math.max(1, metrics.totalDeclarations);
  score += Math.min(40, duplicateRatio * 200);

  // Penalty from duplication issues
  const duplicationIssues = issues.filter((i) => i.id === 'DUPLICATE_DECLARATIONS');

  for (const issue of duplicationIssues) {
    const count = issue.evidence.count ?? 0;
    score += Math.min(10, count / 2);
  }

  return Math.min(100, score);
}

/**
 * Calculate layout risk category score from metrics and issues
 */
export function calculateLayoutRiskScore(
  metrics: GlobalMetrics,
  issues: Issue[]
): number {
  let score = 0;

  // Base score from layout risk
  const ruleCount = Math.max(1, metrics.totalRules);
  const avgLayoutRisk = metrics.overallLayoutRiskScore / ruleCount;
  score += Math.min(40, avgLayoutRisk * 10);

  // Penalty from layout risk issues
  const layoutIssues = issues.filter((i) => i.id === 'LAYOUT_RISK_HOTSPOT');

  for (const issue of layoutIssues) {
    if (issue.severity === 'high') score += 15;
    else if (issue.severity === 'medium') score += 8;
    else score += 3;
  }

  return Math.min(100, score);
}

/**
 * Calculate all category scores
 */
export function calculateCategoryScores(
  metrics: GlobalMetrics,
  issues: Issue[]
): CategoryScores {
  return {
    specificity: calculateSpecificityScore(metrics, issues),
    cascade: calculateCascadeScore(metrics, issues),
    duplication: calculateDuplicationScore(metrics, issues),
    layoutRisk: calculateLayoutRiskScore(metrics, issues),
  };
}

/**
 * Convert score to letter grade
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score <= 20) return 'A';
  if (score <= 40) return 'B';
  if (score <= 60) return 'C';
  if (score <= 80) return 'D';
  return 'F';
}

/**
 * Count issues by severity
 */
export function countIssuesBySeverity(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return counts;
}

/**
 * Generate the summary from metrics and issues
 */
export function generateSummary(metrics: GlobalMetrics, issues: Issue[]): Summary {
  const categoryScores = calculateCategoryScores(metrics, issues);
  const overallScore = calculateOverallScore(categoryScores);

  return {
    overallScore,
    categoryScores,
    grade: scoreToGrade(overallScore),
    totalIssues: issues.length,
    issuesBySeverity: countIssuesBySeverity(issues),
  };
}

/**
 * Generate recommendations based on issues
 */
export function generateRecommendations(issues: Issue[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const issueGroups = groupIssuesByType(issues);

  // Specificity recommendations
  if (issueGroups.highSpecificity.length > 0 || issueGroups.deepSelectors.length > 0) {
    recommendations.push({
      category: 'Specificity',
      title: 'Reduce selector complexity',
      description:
        'Your CSS has high specificity selectors or deeply nested selectors. Consider adopting a flat, single-class approach like BEM or utility-first CSS.',
      priority: issueGroups.highSpecificity.length > 5 ? 'high' : 'medium',
      relatedIssueIds: ['HIGH_SPECIFICITY', 'DEEP_SELECTOR'],
    });
  }

  // Cascade recommendations
  if (issueGroups.importantAbuse.length > 0) {
    recommendations.push({
      category: 'Cascade',
      title: 'Reduce !important usage',
      description:
        'Excessive !important declarations indicate specificity wars. Establish a clear cascade hierarchy using CSS layers or lower-specificity selectors.',
      priority: 'high',
      relatedIssueIds: ['IMPORTANT_ABUSE'],
    });
  }

  if (issueGroups.overridePressure.length > 0) {
    recommendations.push({
      category: 'Cascade',
      title: 'Consolidate override patterns',
      description:
        'Some properties are defined many times across different selectors. Define base styles once and use modifiers for variations.',
      priority: 'medium',
      relatedIssueIds: ['OVERRIDE_PRESSURE'],
    });
  }

  // Duplication recommendations
  if (issueGroups.duplicateDeclarations.length > 0) {
    recommendations.push({
      category: 'Duplication',
      title: 'Extract repeated declarations',
      description:
        'Multiple declarations are repeated throughout your CSS. Extract them into utility classes or CSS custom properties for better maintainability.',
      priority: issueGroups.duplicateDeclarations.length > 10 ? 'high' : 'medium',
      relatedIssueIds: ['DUPLICATE_DECLARATIONS'],
    });
  }

  // Layout risk recommendations
  if (issueGroups.layoutRiskHotspot.length > 0) {
    recommendations.push({
      category: 'Layout',
      title: 'Simplify layout rules',
      description:
        'Some rules contain many layout-affecting properties. Consider using modern layout techniques (flexbox/grid) and isolating positioning from other layout concerns.',
      priority: issueGroups.layoutRiskHotspot.length > 5 ? 'high' : 'low',
      relatedIssueIds: ['LAYOUT_RISK_HOTSPOT'],
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

interface IssueGroups {
  highSpecificity: Issue[];
  deepSelectors: Issue[];
  importantAbuse: Issue[];
  overridePressure: Issue[];
  duplicateDeclarations: Issue[];
  layoutRiskHotspot: Issue[];
}

function groupIssuesByType(issues: Issue[]): IssueGroups {
  return {
    highSpecificity: issues.filter((i) => i.id === 'HIGH_SPECIFICITY'),
    deepSelectors: issues.filter((i) => i.id === 'DEEP_SELECTOR'),
    importantAbuse: issues.filter((i) => i.id === 'IMPORTANT_ABUSE'),
    overridePressure: issues.filter((i) => i.id === 'OVERRIDE_PRESSURE'),
    duplicateDeclarations: issues.filter((i) => i.id === 'DUPLICATE_DECLARATIONS'),
    layoutRiskHotspot: issues.filter((i) => i.id === 'LAYOUT_RISK_HOTSPOT'),
  };
}
