import pc from 'picocolors';
import type { Report, Issue, Severity, Summary, TopSelector, Recommendation } from './core/index.js';

/**
 * Format severity with color
 */
export function formatSeverity(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return pc.bgRed(pc.white(' CRITICAL '));
    case 'high':
      return pc.red('HIGH');
    case 'medium':
      return pc.yellow('MEDIUM');
    case 'low':
      return pc.dim('LOW');
  }
}

/**
 * Format grade with color
 */
export function formatGrade(grade: string): string {
  switch (grade) {
    case 'A':
      return pc.green(pc.bold('A'));
    case 'B':
      return pc.cyan(pc.bold('B'));
    case 'C':
      return pc.yellow(pc.bold('C'));
    case 'D':
      return pc.magenta(pc.bold('D'));
    case 'F':
      return pc.red(pc.bold('F'));
    default:
      return grade;
  }
}

/**
 * Format score with color based on value
 */
export function formatScore(score: number): string {
  if (score <= 20) return pc.green(String(score));
  if (score <= 40) return pc.cyan(String(score));
  if (score <= 60) return pc.yellow(String(score));
  if (score <= 80) return pc.magenta(String(score));
  return pc.red(String(score));
}

/**
 * Format the summary section
 */
export function formatSummary(summary: Summary): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold('═══════════════════════════════════════════════════════════════'));
  lines.push(pc.bold('                    CSS COMPLEXITY REPORT                       '));
  lines.push(pc.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');

  // Overall grade and score
  lines.push(
    `  ${pc.bold('Overall Grade:')} ${formatGrade(summary.grade)}    ${pc.bold('Score:')} ${formatScore(summary.overallScore)}/100 ${pc.dim('(lower is better)')}`
  );
  lines.push('');

  // Category scores
  lines.push(pc.bold('  Category Scores:'));
  lines.push(
    `    Specificity:  ${formatScore(summary.categoryScores.specificity).padStart(3)}/100`
  );
  lines.push(
    `    Cascade:      ${formatScore(summary.categoryScores.cascade).padStart(3)}/100`
  );
  lines.push(
    `    Duplication:  ${formatScore(summary.categoryScores.duplication).padStart(3)}/100`
  );
  lines.push(
    `    Layout Risk:  ${formatScore(summary.categoryScores.layoutRisk).padStart(3)}/100`
  );
  lines.push('');

  // Issue counts
  lines.push(pc.bold('  Issues Found:'));
  lines.push(
    `    ${pc.bgRed(pc.white(' CRITICAL '))} ${summary.issuesBySeverity.critical}   ` +
      `${pc.red('HIGH')} ${summary.issuesBySeverity.high}   ` +
      `${pc.yellow('MEDIUM')} ${summary.issuesBySeverity.medium}   ` +
      `${pc.dim('LOW')} ${summary.issuesBySeverity.low}`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Format an individual issue
 */
export function formatIssue(issue: Issue, index: number): string {
  const lines: string[] = [];

  lines.push(
    `  ${pc.dim(`${index + 1}.`)} ${formatSeverity(issue.severity)} ${pc.bold(issue.title)}`
  );
  lines.push(`     ${pc.dim(issue.evidence.file)}${issue.evidence.line ? pc.dim(`:${issue.evidence.line}`) : ''}`);
  if (issue.evidence.selector) {
    lines.push(`     ${pc.cyan(issue.evidence.selector)}`);
  }
  /* istanbul ignore next - ternary branch for long text truncation */
  lines.push(`     ${pc.dim(issue.why.substring(0, 100))}${issue.why.length > 100 ? '...' : ''}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the issues section
 */
export function formatIssues(issues: Issue[], limit: number = 10): string {
  const lines: string[] = [];

  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push(pc.bold(`  TOP ISSUES (showing ${Math.min(limit, issues.length)} of ${issues.length})`));
  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push('');

  const displayIssues = issues.slice(0, limit);
  for (let i = 0; i < displayIssues.length; i++) {
    const issue = displayIssues[i];
    if (issue) {
      lines.push(formatIssue(issue, i));
    }
  }

  if (issues.length > limit) {
    lines.push(pc.dim(`  ... and ${issues.length - limit} more issues`));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a top selector
 */
export function formatTopSelector(selector: TopSelector, index: number): string {
  const specStr = `[${selector.specificity.ids},${selector.specificity.classes},${selector.specificity.elements}]`;
  /* istanbul ignore next - ternary branches for text truncation and optional line number */
  return (
    `  ${pc.dim(`${index + 1}.`)} ${pc.cyan(selector.selector.substring(0, 50))}${selector.selector.length > 50 ? '...' : ''}\n` +
    `     ${pc.dim(selector.file)}${selector.line ? pc.dim(`:${selector.line}`) : ''}  ` +
    `${pc.yellow(`Spec: ${specStr}`)}  ${pc.magenta(`Depth: ${selector.depth}`)}\n`
  );
}

/**
 * Format the top selectors section
 */
export function formatTopSelectors(selectors: TopSelector[], limit: number = 5): string {
  const lines: string[] = [];

  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push(pc.bold('  WORST SELECTORS (highest complexity)'));
  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push('');

  const displaySelectors = selectors.slice(0, limit);
  for (let i = 0; i < displaySelectors.length; i++) {
    const sel = displaySelectors[i];
    if (sel) {
      lines.push(formatTopSelector(sel, i));
    }
  }

  return lines.join('\n');
}

/**
 * Format a recommendation
 */
export function formatRecommendation(rec: Recommendation, index: number): string {
  /* istanbul ignore next - ternary chain for priority colors */
  const priorityColor =
    rec.priority === 'high' ? pc.red : rec.priority === 'medium' ? pc.yellow : pc.dim;

  return (
    `  ${pc.dim(`${index + 1}.`)} ${priorityColor(`[${rec.priority.toUpperCase()}]`)} ${pc.bold(rec.title)}\n` +
    `     ${pc.dim(rec.description)}\n`
  );
}

/**
 * Format the recommendations section
 */
export function formatRecommendations(recommendations: Recommendation[]): string {
  const lines: string[] = [];

  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push(pc.bold('  RECOMMENDATIONS'));
  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push('');

  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i];
    if (rec) {
      lines.push(formatRecommendation(rec, i));
    }
  }

  return lines.join('\n');
}

/**
 * Format next steps
 */
export function formatNextSteps(): string {
  const lines: string[] = [];

  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push(pc.bold('  NEXT STEPS'));
  lines.push(pc.bold('───────────────────────────────────────────────────────────────'));
  lines.push('');
  lines.push('  1. Address critical and high severity issues first');
  lines.push('  2. Consider adopting CSS methodology (BEM, utility-first)');
  lines.push('  3. Set up CI check: css-complexity-analyzer check --max-score 60');
  lines.push('  4. Re-run analysis after making changes to track progress');
  lines.push('');
  lines.push(pc.dim('  For detailed JSON report: css-complexity-analyzer analyze --format json'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the complete report for console output
 */
export function formatReport(report: Report, options: { silent?: boolean } = {}): string {
  if (options.silent) {
    return '';
  }

  const lines: string[] = [];

  lines.push(formatSummary(report.summary));

  if (report.issues.length > 0) {
    lines.push(formatIssues(report.issues, 10));
  }

  if (report.topSelectors.length > 0) {
    lines.push(formatTopSelectors(report.topSelectors, 5));
  }

  if (report.recommendations.length > 0) {
    lines.push(formatRecommendations(report.recommendations));
  }

  lines.push(formatNextSteps());

  lines.push(pc.bold('═══════════════════════════════════════════════════════════════'));

  return lines.join('\n');
}

/**
 * Format check result
 */
export function formatCheckResult(
  passed: boolean,
  reasons: string[],
  score: number
): string {
  const lines: string[] = [];

  if (passed) {
    lines.push('');
    lines.push(pc.green(pc.bold('✓ CSS complexity check PASSED')));
    lines.push(`  Score: ${formatScore(score)}/100`);
    lines.push('');
  } else {
    lines.push('');
    lines.push(pc.red(pc.bold('✗ CSS complexity check FAILED')));
    lines.push(`  Score: ${formatScore(score)}/100`);
    lines.push('');
    lines.push('  Reasons:');
    for (const reason of reasons) {
      lines.push(`    - ${reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
