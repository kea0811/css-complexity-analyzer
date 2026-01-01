import type {
  Issue,
  ParseResult,
  ParsedRule,
  AnalyzerConfig,
  Severity,
  Specificity,
} from './types.js';
import { specificityToScore } from './parser.js';
import {
  detectDuplicateDeclarations,
  detectOverridePressure,
  calculateLayoutRiskForDeclarations,
  LAYOUT_PROPERTIES,
} from './metrics.js';

/**
 * Rule: Deep selectors - selectors with too many nesting levels
 */
export function checkDeepSelectors(
  parseResults: ParseResult[],
  config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const maxDepth = config.thresholds?.maxSelectorDepth ?? 4;

  for (const result of parseResults) {
    for (const rule of result.rules) {
      for (const selector of rule.selectors) {
        if (selector.depth > maxDepth) {
          const severity = getSeverityForDepth(selector.depth, maxDepth);
          issues.push({
            id: 'DEEP_SELECTOR',
            severity,
            confidence: 0.9,
            title: `Deeply nested selector (depth: ${selector.depth})`,
            why: `Selectors with depth > ${maxDepth} are harder to maintain, increase specificity pressure, and create tight coupling to DOM structure. This selector has ${selector.depth} levels of nesting.`,
            evidence: {
              file: result.file,
              selector: selector.raw,
              line: rule.line,
              column: rule.column,
              depth: selector.depth,
            },
            suggestions: [
              {
                action: 'Flatten selector',
                description: 'Replace with a single class that describes the component/element purpose',
              },
              {
                action: 'Use BEM naming',
                description: 'Adopt BEM (Block__Element--Modifier) naming to flatten hierarchy',
              },
            ],
            tags: ['specificity', 'maintainability'],
          });
        }
      }
    }
  }

  return issues;
}

function getSeverityForDepth(depth: number, maxDepth: number): Severity {
  const excess = depth - maxDepth;
  if (excess >= 4) return 'critical';
  if (excess >= 2) return 'high';
  // excess >= 1 is always true when this function is called (depth > maxDepth)
  return 'medium';
}

/**
 * Rule: High specificity - selectors with IDs or excessive class chains
 */
export function checkHighSpecificity(
  parseResults: ParseResult[],
  config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const maxScore = config.thresholds?.maxSpecificityScore ?? 40;

  for (const result of parseResults) {
    for (const rule of result.rules) {
      for (const selector of rule.selectors) {
        const score = specificityToScore(selector.specificity);

        if (score > maxScore || selector.hasId) {
          const severity = getSeverityForSpecificity(selector.specificity, maxScore);
          const reasons: string[] = [];

          if (selector.hasId) {
            reasons.push('uses ID selector');
          }
          if (score > maxScore) {
            reasons.push(`specificity score (${score}) exceeds threshold (${maxScore})`);
          }

          issues.push({
            id: 'HIGH_SPECIFICITY',
            severity,
            confidence: 0.95,
            title: `High specificity selector (${formatSpecificity(selector.specificity)})`,
            why: `High specificity selectors ${reasons.join(' and ')}. This makes styles harder to override without resorting to !important or equally high specificity, leading to specificity wars.`,
            evidence: {
              file: result.file,
              selector: selector.raw,
              line: rule.line,
              column: rule.column,
              specificity: selector.specificity,
            },
            suggestions: selector.hasId
              ? [
                  {
                    action: 'Replace ID with class',
                    description: 'Convert #id selectors to .class selectors for lower specificity',
                  },
                  {
                    action: 'Use data attributes',
                    description: 'Consider [data-component="name"] for JavaScript hooks instead of IDs',
                  },
                ]
              : [
                  {
                    action: 'Simplify selector',
                    description: 'Reduce the number of classes/elements in the selector chain',
                  },
                  {
                    action: 'Use single class',
                    description: 'Prefer single-purpose utility classes over complex selector chains',
                  },
                ],
            tags: ['specificity', 'cascade', 'maintainability'],
          });
        }
      }
    }
  }

  return issues;
}

/* istanbul ignore next - all branches tested but coverage misses ternary-like logic */
function getSeverityForSpecificity(specificity: Specificity, maxScore: number): Severity {
  if (specificity.ids >= 2) return 'critical';
  if (specificity.ids >= 1) return 'high';
  const score = specificityToScore(specificity);
  if (score > maxScore * 2) return 'high';
  if (score > maxScore * 1.5) return 'medium';
  return 'low';
}

function formatSpecificity(specificity: Specificity): string {
  return `${specificity.ids},${specificity.classes},${specificity.elements}`;
}

/**
 * Rule: !important abuse - excessive use of !important
 */
export function checkImportantAbuse(
  parseResults: ParseResult[],
  config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const maxPerFile = config.thresholds?.maxImportantPerFile ?? 5;

  // Track per-file counts
  const fileCounts = new Map<string, { count: number; rules: ParsedRule[] }>();

  for (const result of parseResults) {
    for (const rule of result.rules) {
      const importantDecls = rule.declarations.filter((d) => d.important);
      if (importantDecls.length > 0) {
        const existing = fileCounts.get(result.file);
        if (existing) {
          existing.count += importantDecls.length;
          existing.rules.push(rule);
        } else {
          fileCounts.set(result.file, {
            count: importantDecls.length,
            rules: [rule],
          });
        }
      }
    }
  }

  // Generate issues for files exceeding threshold
  for (const [file, { count, rules }] of fileCounts) {
    if (count > maxPerFile) {
      const severity = getSeverityForImportantCount(count, maxPerFile);
      const firstRule = rules[0];

      issues.push({
        id: 'IMPORTANT_ABUSE',
        severity,
        confidence: 0.85,
        title: `Excessive !important usage (${count} occurrences)`,
        why: `This file contains ${count} !important declarations, exceeding the threshold of ${maxPerFile}. Overuse of !important indicates specificity wars and makes styles unpredictable and hard to maintain.`,
        evidence: {
          file,
          selector: firstRule?.selectors[0]?.raw,
          line: firstRule?.line,
          count,
        },
        suggestions: [
          {
            action: 'Reduce base specificity',
            description: 'Lower the specificity of selectors so !important becomes unnecessary',
          },
          {
            action: 'Use CSS layers',
            description: 'Consider @layer to establish a predictable cascade order without !important',
          },
          {
            action: 'Consolidate styles',
            description: 'Merge competing rules into a single source of truth',
          },
        ],
        tags: ['cascade', 'override', 'maintainability'],
      });
    }
  }

  // Also flag individual high-impact !important usages
  for (const result of parseResults) {
    for (const rule of result.rules) {
      for (const decl of rule.declarations) {
        if (decl.important && LAYOUT_PROPERTIES.has(decl.property)) {
          issues.push({
            id: 'IMPORTANT_ABUSE',
            severity: 'medium',
            confidence: 0.8,
            title: `!important on layout property: ${decl.property}`,
            why: `Using !important on layout-affecting properties like ${decl.property} can cause unexpected layout behavior and makes responsive adjustments difficult.`,
            evidence: {
              file: result.file,
              selector: rule.selectors[0]?.raw,
              property: decl.property,
              value: decl.value,
              line: rule.line,
            },
            suggestions: [
              {
                action: 'Remove !important',
                description: `Fix the cascade issue for ${decl.property} instead of forcing with !important`,
              },
            ],
            tags: ['cascade', 'layout-risk'],
          });
        }
      }
    }
  }

  return issues;
}

function getSeverityForImportantCount(count: number, maxPerFile: number): Severity {
  const ratio = count / maxPerFile;
  if (ratio >= 4) return 'critical';
  if (ratio >= 2.5) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}

/**
 * Rule: Duplicate declarations - same property:value repeated excessively
 */
export function checkDuplicateDeclarations(
  parseResults: ParseResult[],
  config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const minCount = config.thresholds?.maxDuplicateDeclarations ?? 3;

  const duplicates = detectDuplicateDeclarations(parseResults, minCount);

  for (const [declaration, { count, locations }] of duplicates) {
    const parts = declaration.split(':');
    /* istanbul ignore next - defensive fallback */
    const property = parts[0] ?? '';
    /* istanbul ignore next - defensive fallback */
    const value = parts.slice(1).join(':') || '';
    const severity = getSeverityForDuplicateCount(count, minCount);
    // firstLocation is guaranteed to exist since duplicates map only contains items with count >= minCount
    const firstLocation = locations[0]!;

    issues.push({
      id: 'DUPLICATE_DECLARATIONS',
      severity,
      confidence: 0.75,
      title: `Duplicate declaration: ${property} (${count} times)`,
      why: `The declaration "${property}: ${value}" appears ${count} times across your CSS. This indicates potential for consolidation into a utility class or CSS custom property.`,
      evidence: {
        file: firstLocation.file,
        property,
        value,
        line: firstLocation.line,
        selector: firstLocation.selector,
        count,
      },
      suggestions: [
        {
          action: 'Create utility class',
          description: `Extract to a reusable utility class like .${property.replace(/[^a-z]/gi, '-')}-${value.replace(/[^a-z0-9]/gi, '-')}`,
        },
        {
          action: 'Use CSS custom property',
          description: `Define --${property}: ${value} and reference with var(--${property})`,
        },
      ],
      tags: ['duplication', 'maintainability'],
    });
  }

  return issues;
}

function getSeverityForDuplicateCount(count: number, minCount: number): Severity {
  if (count >= minCount * 5) return 'high';
  if (count >= minCount * 3) return 'medium';
  return 'low';
}

/**
 * Rule: Layout risk hotspot - rules with many layout-affecting properties
 */
export function checkLayoutRiskHotspot(
  parseResults: ParseResult[],
  _config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const riskThreshold = 5;

  for (const result of parseResults) {
    for (const rule of result.rules) {
      const riskScore = calculateLayoutRiskForDeclarations(rule.declarations);

      if (riskScore >= riskThreshold) {
        const layoutProps = rule.declarations
          .filter((d) => LAYOUT_PROPERTIES.has(d.property))
          .map((d) => d.property);

        const severity = getSeverityForLayoutRisk(riskScore);
        const hasPositioning = rule.declarations.some(
          (d) => d.property === 'position' && ['absolute', 'fixed'].includes(d.value)
        );

        issues.push({
          id: 'LAYOUT_RISK_HOTSPOT',
          severity,
          confidence: 0.7,
          title: `Layout risk hotspot (risk score: ${riskScore})`,
          why: `This rule contains ${layoutProps.length} layout-affecting properties${hasPositioning ? ' including absolute/fixed positioning' : ''}. Complex layout rules are fragile and can cause unexpected behavior across different viewport sizes.`,
          evidence: {
            file: result.file,
            selector: rule.selectors[0]?.raw,
            line: rule.line,
            count: layoutProps.length,
          },
          suggestions: hasPositioning
            ? [
                {
                  action: 'Use relative positioning',
                  description: 'Consider using flexbox/grid with relative positioning instead of absolute',
                },
                {
                  action: 'Isolate positioning',
                  description: 'Split positioning rules from other layout properties for better maintainability',
                },
              ]
            : [
                {
                  action: 'Simplify layout',
                  description: 'Consider using modern layout techniques (flexbox/grid) to reduce property count',
                },
                {
                  action: 'Component isolation',
                  description: 'Ensure layout rules are scoped to specific components',
                },
              ],
          tags: ['layout-risk', 'maintainability'],
        });
      }
    }
  }

  return issues;
}

function getSeverityForLayoutRisk(riskScore: number): Severity {
  if (riskScore >= 15) return 'high';
  if (riskScore >= 10) return 'medium';
  return 'low';
}

/**
 * Rule: Override pressure - properties that are overridden too frequently
 */
export function checkOverridePressure(
  parseResults: ParseResult[],
  _config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const minOverrides = 5;

  const overridePressure = detectOverridePressure(parseResults, minOverrides);

  for (const [property, { overrideCount, selectors }] of overridePressure) {
    // Calculate specificity variance - high variance indicates specificity wars
    const scores = selectors.map((s) => specificityToScore(s.specificity));
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const variance = maxScore - minScore;

    const severity = getSeverityForOverridePressure(overrideCount, variance);
    // firstSelector is guaranteed to exist since overridePressure map only contains items with count >= minOverrides
    const firstSelector = selectors[0]!;

    issues.push({
      id: 'OVERRIDE_PRESSURE',
      severity,
      confidence: 0.7,
      title: `High override pressure: ${property} (${overrideCount} definitions)`,
      why: `The property "${property}" is defined ${overrideCount} times across different selectors with specificity ranging from ${minScore} to ${maxScore}. This suggests competing styles and potential cascade conflicts.`,
      evidence: {
        file: firstSelector.file,
        property,
        selector: firstSelector.selector,
        line: firstSelector.line,
        count: overrideCount,
      },
      suggestions: [
        {
          action: 'Consolidate base styles',
          description: `Define ${property} once in a base rule and use modifiers for variations`,
        },
        {
          action: 'Review cascade order',
          description: 'Ensure styles follow a logical cascade from general to specific',
        },
        {
          action: 'Use CSS custom properties',
          description: `Consider using --${property} custom property that can be overridden at component level`,
        },
      ],
      tags: ['cascade', 'override', 'maintainability'],
    });
  }

  return issues;
}

function getSeverityForOverridePressure(count: number, variance: number): Severity {
  if (count >= 15 && variance >= 50) return 'high';
  if (count >= 10 || variance >= 30) return 'medium';
  return 'low';
}

/**
 * Rule: Missing CSS layers - suggest using @layer for cascade management
 */
export function checkMissingLayers(
  parseResults: ParseResult[],
  _config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];

  // Check if any file uses layers
  const anyUsesLayers = parseResults.some((r) => r.usesLayers);

  // Count total rules and !important usage across all files
  let totalRules = 0;
  let totalImportant = 0;
  let filesWithManyRules = 0;

  for (const result of parseResults) {
    totalRules += result.rules.length;
    for (const rule of result.rules) {
      totalImportant += rule.declarations.filter((d) => d.important).length;
    }
    if (result.rules.length >= 20) {
      filesWithManyRules++;
    }
  }

  // Suggest layers if:
  // 1. No layers are used AND
  // 2. Codebase has significant complexity (many rules, files, or !important usage)
  if (!anyUsesLayers && (totalRules >= 50 || totalImportant >= 5 || filesWithManyRules >= 3)) {
    const severity = getSeverityForMissingLayers(totalRules, totalImportant);
    /* istanbul ignore next - parseResults is guaranteed non-empty when condition is true (totalRules >= 50) */
    const firstFile = parseResults[0]?.file ?? 'unknown';

    issues.push({
      id: 'MISSING_LAYERS',
      severity,
      confidence: 0.7,
      title: 'CSS @layer not used for cascade management',
      why: `Your CSS has ${totalRules} rules${totalImportant > 0 ? ` and ${totalImportant} !important declarations` : ''}, but doesn't use @layer for cascade control. CSS Cascade Layers (@layer) provide a cleaner way to manage style precedence without specificity battles or !important.`,
      evidence: {
        file: firstFile,
        count: totalRules,
      },
      suggestions: [
        {
          action: 'Organize styles into layers',
          description:
            'Structure CSS with @layer reset, base, components, utilities for predictable cascade order',
        },
        {
          action: 'Define layer order upfront',
          description:
            'Use @layer reset, base, components, utilities; at the top of your CSS to establish precedence',
        },
        {
          action: 'Replace !important with layers',
          description:
            'Styles in later layers automatically override earlier layers without needing !important',
        },
      ],
      tags: ['cascade', 'layer', 'maintainability'],
    });
  }

  return issues;
}

function getSeverityForMissingLayers(totalRules: number, totalImportant: number): Severity {
  if (totalRules >= 200 || totalImportant >= 20) return 'medium';
  if (totalRules >= 100 || totalImportant >= 10) return 'low';
  return 'low';
}

/**
 * Run all enabled rules and collect issues
 */
export function runAllRules(
  parseResults: ParseResult[],
  config: AnalyzerConfig
): Issue[] {
  const issues: Issue[] = [];
  const rules = config.rules ?? {};

  if (rules.deepSelectors !== false) {
    issues.push(...checkDeepSelectors(parseResults, config));
  }

  if (rules.highSpecificity !== false) {
    issues.push(...checkHighSpecificity(parseResults, config));
  }

  if (rules.importantAbuse !== false) {
    issues.push(...checkImportantAbuse(parseResults, config));
  }

  if (rules.duplicateDeclarations !== false) {
    issues.push(...checkDuplicateDeclarations(parseResults, config));
  }

  if (rules.layoutRiskHotspot !== false) {
    issues.push(...checkLayoutRiskHotspot(parseResults, config));
  }

  if (rules.overridePressure !== false) {
    issues.push(...checkOverridePressure(parseResults, config));
  }

  if (rules.missingLayers !== false) {
    issues.push(...checkMissingLayers(parseResults, config));
  }

  // Sort issues by severity (critical > high > medium > low)
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
