import type {
  ParseResult,
  ParsedRule,
  FileMetrics,
  GlobalMetrics,
  Specificity,
  TopSelector,
  ParsedDeclaration,
} from './types.js';
import { specificityToScore, compareSpecificity } from './parser.js';

/**
 * Layout-affecting CSS properties that contribute to layout risk
 */
export const LAYOUT_PROPERTIES = new Set([
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'display',
  'position',
  'float',
  'clear',
  'flex',
  'flex-basis',
  'flex-grow',
  'flex-shrink',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-self',
  'align-content',
  'order',
  'grid',
  'grid-template',
  'grid-template-columns',
  'grid-template-rows',
  'grid-template-areas',
  'grid-column',
  'grid-row',
  'grid-area',
  'grid-gap',
  'gap',
  'row-gap',
  'column-gap',
  'border',
  'border-width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'box-sizing',
  'overflow',
  'overflow-x',
  'overflow-y',
  'white-space',
  'word-wrap',
  'word-break',
  'text-overflow',
  'table-layout',
  'vertical-align',
  'line-height',
  'font-size',
  'writing-mode',
  'columns',
  'column-count',
  'column-width',
  'column-span',
  'break-before',
  'break-after',
  'break-inside',
]);

/**
 * High-risk property combinations that indicate potential layout fragility
 */
export const RISKY_COMBINATIONS: Array<{ properties: string[]; riskMultiplier: number }> = [
  { properties: ['position', 'top', 'left'], riskMultiplier: 1.5 },
  { properties: ['position', 'top', 'right'], riskMultiplier: 1.5 },
  { properties: ['position', 'bottom', 'left'], riskMultiplier: 1.5 },
  { properties: ['position', 'bottom', 'right'], riskMultiplier: 1.5 },
  { properties: ['float', 'width'], riskMultiplier: 1.3 },
  { properties: ['display', 'position'], riskMultiplier: 1.2 },
];

/**
 * Calculate the average of an array of numbers
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate the average specificity from an array of specificities
 */
export function calculateAverageSpecificity(specificities: Specificity[]): Specificity {
  if (specificities.length === 0) {
    return { ids: 0, classes: 0, elements: 0 };
  }

  const sumIds = specificities.reduce((sum, s) => sum + s.ids, 0);
  const sumClasses = specificities.reduce((sum, s) => sum + s.classes, 0);
  const sumElements = specificities.reduce((sum, s) => sum + s.elements, 0);

  return {
    ids: Math.round((sumIds / specificities.length) * 100) / 100,
    classes: Math.round((sumClasses / specificities.length) * 100) / 100,
    elements: Math.round((sumElements / specificities.length) * 100) / 100,
  };
}

/**
 * Find the maximum specificity from an array
 */
export function findMaxSpecificity(specificities: Specificity[]): Specificity {
  if (specificities.length === 0) {
    return { ids: 0, classes: 0, elements: 0 };
  }

  return specificities.reduce((max, current) => {
    return compareSpecificity(current, max) > 0 ? current : max;
  });
}

/**
 * Count !important declarations in a rule
 */
export function countImportantInRule(rule: ParsedRule): number {
  return rule.declarations.filter((d) => d.important).length;
}

/**
 * Calculate layout risk score for a set of declarations
 * Higher score = higher risk
 */
export function calculateLayoutRiskForDeclarations(declarations: ParsedDeclaration[]): number {
  let riskScore = 0;
  const presentProperties = new Set(declarations.map((d) => d.property));

  // Base risk from layout properties
  for (const decl of declarations) {
    if (LAYOUT_PROPERTIES.has(decl.property)) {
      riskScore += 1;

      // Extra risk for absolute/fixed positioning
      if (decl.property === 'position' && ['absolute', 'fixed'].includes(decl.value)) {
        riskScore += 2;
      }

      // Extra risk for negative margins
      if (decl.property.startsWith('margin') && decl.value.includes('-')) {
        riskScore += 1;
      }
    }
  }

  // Check for risky combinations
  for (const combo of RISKY_COMBINATIONS) {
    if (combo.properties.every((prop) => presentProperties.has(prop))) {
      riskScore = Math.round(riskScore * combo.riskMultiplier);
    }
  }

  return riskScore;
}

/**
 * Calculate metrics for a single parsed file
 */
export function calculateFileMetrics(parseResult: ParseResult): FileMetrics {
  const { file, rules } = parseResult;

  let totalSelectors = 0;
  let totalDeclarations = 0;
  let maxSelectorDepth = 0;
  let importantCount = 0;
  let layoutRiskScore = 0;

  const allDepths: number[] = [];
  const allSpecificities: Specificity[] = [];

  for (const rule of rules) {
    totalDeclarations += rule.declarations.length;
    importantCount += countImportantInRule(rule);
    layoutRiskScore += calculateLayoutRiskForDeclarations(rule.declarations);

    for (const selector of rule.selectors) {
      totalSelectors++;
      allDepths.push(selector.depth);
      allSpecificities.push(selector.specificity);

      if (selector.depth > maxSelectorDepth) {
        maxSelectorDepth = selector.depth;
      }
    }
  }

  return {
    file,
    totalRules: rules.length,
    totalSelectors,
    totalDeclarations,
    maxSelectorDepth,
    avgSelectorDepth: Math.round(calculateAverage(allDepths) * 100) / 100,
    maxSpecificity: findMaxSpecificity(allSpecificities),
    avgSpecificity: calculateAverageSpecificity(allSpecificities),
    importantCount,
    duplicateDeclarationCount: 0, // Calculated separately in duplication metrics
    layoutRiskScore,
  };
}

/**
 * Calculate global metrics from multiple file metrics
 */
export function calculateGlobalMetrics(fileMetrics: FileMetrics[]): GlobalMetrics {
  if (fileMetrics.length === 0) {
    return {
      totalFiles: 0,
      totalRules: 0,
      totalSelectors: 0,
      totalDeclarations: 0,
      maxSelectorDepth: 0,
      avgSelectorDepth: 0,
      maxSpecificity: { ids: 0, classes: 0, elements: 0 },
      avgSpecificity: { ids: 0, classes: 0, elements: 0 },
      totalImportantCount: 0,
      totalDuplicateDeclarations: 0,
      overallLayoutRiskScore: 0,
    };
  }

  const allAvgDepths = fileMetrics.map((m) => m.avgSelectorDepth);
  const allAvgSpecificities = fileMetrics.map((m) => m.avgSpecificity);
  const allMaxSpecificities = fileMetrics.map((m) => m.maxSpecificity);

  return {
    totalFiles: fileMetrics.length,
    totalRules: fileMetrics.reduce((sum, m) => sum + m.totalRules, 0),
    totalSelectors: fileMetrics.reduce((sum, m) => sum + m.totalSelectors, 0),
    totalDeclarations: fileMetrics.reduce((sum, m) => sum + m.totalDeclarations, 0),
    maxSelectorDepth: Math.max(...fileMetrics.map((m) => m.maxSelectorDepth)),
    avgSelectorDepth: Math.round(calculateAverage(allAvgDepths) * 100) / 100,
    maxSpecificity: findMaxSpecificity(allMaxSpecificities),
    avgSpecificity: calculateAverageSpecificity(allAvgSpecificities),
    totalImportantCount: fileMetrics.reduce((sum, m) => sum + m.importantCount, 0),
    totalDuplicateDeclarations: fileMetrics.reduce((sum, m) => sum + m.duplicateDeclarationCount, 0),
    overallLayoutRiskScore: fileMetrics.reduce((sum, m) => sum + m.layoutRiskScore, 0),
  };
}

/**
 * Extract top selectors (worst offenders) from parse results
 */
export function extractTopSelectors(
  parseResults: ParseResult[],
  limit: number = 10
): TopSelector[] {
  const selectors: TopSelector[] = [];

  for (const result of parseResults) {
    for (const rule of result.rules) {
      for (const selector of rule.selectors) {
        const score =
          specificityToScore(selector.specificity) * 2 + selector.depth * 3;
        selectors.push({
          selector: selector.raw,
          file: result.file,
          line: rule.line,
          specificity: selector.specificity,
          depth: selector.depth,
          score,
        });
      }
    }
  }

  // Sort by score descending and return top N
  return selectors.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Detect duplicate declarations across all files
 */
/* istanbul ignore next - default parameter values */
export function detectDuplicateDeclarations(
  parseResults: ParseResult[],
  minCount: number = 3
): Map<
  string,
  {
    count: number;
    locations: Array<{ file: string; line?: number; selector: string }>;
  }
> {
  const declarationMap = new Map<
    string,
    {
      count: number;
      locations: Array<{ file: string; line?: number; selector: string }>;
    }
  >();

  for (const result of parseResults) {
    for (const rule of result.rules) {
      for (const decl of rule.declarations) {
        // Normalize the declaration key
        const key = `${decl.property}:${decl.value.trim().toLowerCase()}`;
        const location = {
          file: result.file,
          line: rule.line,
          /* istanbul ignore next - defensive fallback for empty selectors */
          selector: rule.selectors[0]?.raw || '',
        };

        const existing = declarationMap.get(key);
        if (existing) {
          existing.count++;
          existing.locations.push(location);
        } else {
          declarationMap.set(key, { count: 1, locations: [location] });
        }
      }
    }
  }

  // Filter to only include duplicates above threshold
  const duplicates = new Map<
    string,
    {
      count: number;
      locations: Array<{ file: string; line?: number; selector: string }>;
    }
  >();

  for (const [key, value] of declarationMap) {
    if (value.count >= minCount) {
      duplicates.set(key, value);
    }
  }

  return duplicates;
}

/**
 * Detect declaration block duplicates (sets of 3+ properties repeated)
 */
/* istanbul ignore next - default parameter values */
export function detectDuplicateBlocks(
  parseResults: ParseResult[],
  minProperties: number = 3,
  minOccurrences: number = 2
): Array<{
  properties: string[];
  occurrences: Array<{ file: string; line?: number; selector: string }>;
}> {
  const blockMap = new Map<
    string,
    {
      properties: string[];
      occurrences: Array<{ file: string; line?: number; selector: string }>;
    }
  >();

  for (const result of parseResults) {
    for (const rule of result.rules) {
      if (rule.declarations.length < minProperties) continue;

      // Create a normalized key from sorted property:value pairs
      const pairs = rule.declarations
        .map((d) => `${d.property}:${d.value.trim().toLowerCase()}`)
        .sort();

      // Check all combinations of minProperties or more
      for (let size = minProperties; size <= pairs.length; size++) {
        const key = pairs.slice(0, size).join('|');
        const occurrence = {
          file: result.file,
          line: rule.line,
          /* istanbul ignore next - defensive fallback for empty selectors */
          selector: rule.selectors[0]?.raw || '',
        };

        const existing = blockMap.get(key);
        if (existing) {
          existing.occurrences.push(occurrence);
        } else {
          blockMap.set(key, {
            properties: pairs.slice(0, size),
            occurrences: [occurrence],
          });
        }
      }
    }
  }

  // Filter and return only duplicated blocks
  return Array.from(blockMap.values())
    .filter((block) => block.occurrences.length >= minOccurrences)
    .sort((a, b) => b.occurrences.length - a.occurrences.length);
}

/**
 * Detect override pressure: properties that are overridden frequently
 */
/* istanbul ignore next - default parameter values */
export function detectOverridePressure(
  parseResults: ParseResult[],
  minOverrides: number = 5
): Map<
  string,
  {
    property: string;
    overrideCount: number;
    selectors: Array<{ selector: string; file: string; line?: number; specificity: Specificity }>;
  }
> {
  const propertyMap = new Map<
    string,
    {
      property: string;
      overrideCount: number;
      selectors: Array<{ selector: string; file: string; line?: number; specificity: Specificity }>;
    }
  >();

  for (const result of parseResults) {
    for (const rule of result.rules) {
      for (const decl of rule.declarations) {
        const existing = propertyMap.get(decl.property);
        /* istanbul ignore next - defensive fallbacks for empty selectors */
        const selectorInfo = {
          selector: rule.selectors[0]?.raw || '',
          file: result.file,
          line: rule.line,
          specificity: rule.selectors[0]?.specificity || { ids: 0, classes: 0, elements: 0 },
        };

        if (existing) {
          existing.overrideCount++;
          existing.selectors.push(selectorInfo);
        } else {
          propertyMap.set(decl.property, {
            property: decl.property,
            overrideCount: 1,
            selectors: [selectorInfo],
          });
        }
      }
    }
  }

  // Filter to properties with high override count
  const overridePressure = new Map<
    string,
    {
      property: string;
      overrideCount: number;
      selectors: Array<{ selector: string; file: string; line?: number; specificity: Specificity }>;
    }
  >();

  for (const [key, value] of propertyMap) {
    if (value.overrideCount >= minOverrides) {
      overridePressure.set(key, value);
    }
  }

  return overridePressure;
}
