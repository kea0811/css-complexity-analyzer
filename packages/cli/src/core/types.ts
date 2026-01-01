/**
 * Severity levels for issues
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Issue identifiers for stable referencing
 */
export type IssueId =
  | 'DEEP_SELECTOR'
  | 'HIGH_SPECIFICITY'
  | 'IMPORTANT_ABUSE'
  | 'DUPLICATE_DECLARATIONS'
  | 'LAYOUT_RISK_HOTSPOT'
  | 'OVERRIDE_PRESSURE'
  | 'MISSING_LAYERS';

/**
 * Tags for categorizing issues
 */
export type IssueTag =
  | 'specificity'
  | 'cascade'
  | 'override'
  | 'layout-risk'
  | 'duplication'
  | 'maintainability'
  | 'layer';

/**
 * Specificity represented as [ids, classes, elements]
 */
export interface Specificity {
  ids: number;
  classes: number;
  elements: number;
}

/**
 * Evidence for an issue, providing context about where/what caused it
 */
export interface Evidence {
  file: string;
  selector?: string;
  property?: string;
  value?: string;
  line?: number;
  column?: number;
  specificity?: Specificity;
  depth?: number;
  count?: number;
}

/**
 * A suggestion for fixing an issue
 */
export interface Suggestion {
  action: string;
  description: string;
}

/**
 * An actionable issue detected during analysis
 */
export interface Issue {
  id: IssueId;
  severity: Severity;
  confidence: number;
  title: string;
  why: string;
  evidence: Evidence;
  suggestions: Suggestion[];
  tags: IssueTag[];
}

/**
 * Metrics for a single CSS file
 */
export interface FileMetrics {
  file: string;
  totalRules: number;
  totalSelectors: number;
  totalDeclarations: number;
  maxSelectorDepth: number;
  avgSelectorDepth: number;
  maxSpecificity: Specificity;
  avgSpecificity: Specificity;
  importantCount: number;
  duplicateDeclarationCount: number;
  layoutRiskScore: number;
}

/**
 * Global/aggregated metrics across all files
 */
export interface GlobalMetrics {
  totalFiles: number;
  totalRules: number;
  totalSelectors: number;
  totalDeclarations: number;
  maxSelectorDepth: number;
  avgSelectorDepth: number;
  maxSpecificity: Specificity;
  avgSpecificity: Specificity;
  totalImportantCount: number;
  totalDuplicateDeclarations: number;
  overallLayoutRiskScore: number;
}

/**
 * A selector with its associated metrics (for "worst offenders" list)
 */
export interface TopSelector {
  selector: string;
  file: string;
  line?: number;
  specificity: Specificity;
  depth: number;
  score: number;
}

/**
 * Category scores for the summary
 */
export interface CategoryScores {
  specificity: number;
  cascade: number;
  duplication: number;
  layoutRisk: number;
}

/**
 * Summary of the analysis
 */
export interface Summary {
  overallScore: number;
  categoryScores: CategoryScores;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalIssues: number;
  issuesBySeverity: Record<Severity, number>;
}

/**
 * Grouped recommendations
 */
export interface Recommendation {
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  relatedIssueIds: IssueId[];
}

/**
 * The complete report output
 */
export interface Report {
  version: string;
  timestamp: string;
  summary: Summary;
  globalMetrics: GlobalMetrics;
  fileMetrics: FileMetrics[];
  issues: Issue[];
  topSelectors: TopSelector[];
  recommendations: Recommendation[];
}

/**
 * Configuration options for the analyzer
 */
export interface AnalyzerConfig {
  include?: string[];
  exclude?: string[];
  thresholds?: {
    maxSelectorDepth?: number;
    maxSpecificityScore?: number;
    maxImportantPerFile?: number;
    maxDuplicateDeclarations?: number;
  };
  ignorePatterns?: string[];
  maxScore?: number;
  rules?: {
    deepSelectors?: boolean;
    highSpecificity?: boolean;
    importantAbuse?: boolean;
    duplicateDeclarations?: boolean;
    layoutRiskHotspot?: boolean;
    overridePressure?: boolean;
    missingLayers?: boolean;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<AnalyzerConfig> = {
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
    missingLayers: true,
  },
};

/**
 * Parsed selector information
 */
export interface ParsedSelector {
  raw: string;
  depth: number;
  specificity: Specificity;
  hasId: boolean;
  hasPseudoClass: boolean;
  hasPseudoElement: boolean;
  hasAttribute: boolean;
}

/**
 * Parsed declaration information
 */
export interface ParsedDeclaration {
  property: string;
  value: string;
  important: boolean;
}

/**
 * Parsed rule information
 */
export interface ParsedRule {
  selectors: ParsedSelector[];
  declarations: ParsedDeclaration[];
  file: string;
  line?: number;
  column?: number;
  /** The @layer this rule belongs to, if any */
  layer?: string;
}

/**
 * Result of parsing a CSS file
 */
export interface ParseResult {
  file: string;
  rules: ParsedRule[];
  errors: string[];
  /** List of @layer names found in the file */
  layers: string[];
  /** Whether the file uses @layer at all */
  usesLayers: boolean;
}

/**
 * Input for analysis - either a file path or CSS content
 */
export interface AnalysisInput {
  type: 'file' | 'content';
  path?: string;
  content?: string;
  filename?: string;
}
