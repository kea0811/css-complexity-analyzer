// Types
export type {
  Severity,
  IssueId,
  IssueTag,
  Specificity,
  Evidence,
  Suggestion,
  Issue,
  FileMetrics,
  GlobalMetrics,
  TopSelector,
  CategoryScores,
  Summary,
  Recommendation,
  Report,
  AnalyzerConfig,
  ParsedSelector,
  ParsedDeclaration,
  ParsedRule,
  ParseResult,
  AnalysisInput,
} from './types.js';

export { DEFAULT_CONFIG } from './types.js';

// Parser
export {
  calculateSelectorDepth,
  calculateSpecificity,
  specificityToScore,
  compareSpecificity,
  parseSelector,
  parseCSS,
  parseCSSFile,
  combineParseResults,
  extractDeclarationPairs,
} from './parser.js';

// Metrics
export {
  LAYOUT_PROPERTIES,
  RISKY_COMBINATIONS,
  calculateAverage,
  calculateAverageSpecificity,
  findMaxSpecificity,
  countImportantInRule,
  calculateLayoutRiskForDeclarations,
  calculateFileMetrics,
  calculateGlobalMetrics,
  extractTopSelectors,
  detectDuplicateDeclarations,
  detectDuplicateBlocks,
  detectOverridePressure,
} from './metrics.js';

// Rules
export {
  checkDeepSelectors,
  checkHighSpecificity,
  checkImportantAbuse,
  checkDuplicateDeclarations,
  checkLayoutRiskHotspot,
  checkOverridePressure,
  runAllRules,
} from './rules.js';

// Scoring
export {
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

// Analyzer
export {
  mergeConfig,
  findCSSFiles,
  parseFiles,
  parseContent,
  analyze,
  analyzeDirectory,
  analyzeCSS,
  generateReport,
  checkThresholds,
  formatReportAsJSON,
} from './analyzer.js';
