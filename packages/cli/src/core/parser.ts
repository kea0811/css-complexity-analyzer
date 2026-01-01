import postcss, { Root, Rule, Declaration, AtRule } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import type {
  ParseResult,
  ParsedRule,
  ParsedSelector,
  ParsedDeclaration,
  Specificity,
} from './types.js';

/**
 * Calculate selector depth (number of combinator levels)
 * e.g., ".a .b > .c" = 3 (three parts connected by combinators)
 */
export function calculateSelectorDepth(selector: string): number {
  let depth = 1;
  const processor = selectorParser((selectors) => {
    selectors.walk((node) => {
      if (node.type === 'combinator') {
        depth++;
      }
    });
  });
  try {
    processor.processSync(selector);
  } catch {
    // If parsing fails, estimate by counting spaces and combinators
    return selector.split(/[\s>+~]/).filter((s) => s.trim()).length;
  }
  return depth;
}

/**
 * Calculate specificity for a selector
 * Returns [ids, classes, elements]
 */
export function calculateSpecificity(selector: string): Specificity {
  let ids = 0;
  let classes = 0;
  let elements = 0;

  const processor = selectorParser((selectors) => {
    selectors.walk((node) => {
      switch (node.type) {
        case 'id':
          ids++;
          break;
        case 'class':
        case 'attribute':
          classes++;
          break;
        case 'pseudo':
          // Pseudo-elements count as elements, pseudo-classes count as classes
          if (
            node.value.startsWith('::') ||
            ['before', 'after', 'first-line', 'first-letter', 'selection', 'placeholder'].includes(
              node.value.replace(/^:+/, '')
            )
          ) {
            elements++;
          } else if (
            !['not', 'is', 'where', 'has'].includes(node.value.replace(/^:+/, ''))
          ) {
            // :not(), :is(), :where() don't add specificity themselves
            // but their contents do (handled by walking into them)
            classes++;
          }
          break;
        case 'tag':
          if (node.value !== '*') {
            elements++;
          }
          break;
      }
    });
  });

  try {
    processor.processSync(selector);
  } catch /* istanbul ignore next - defensive fallback for parser errors */ {
    // Fallback: simple regex-based estimation
    ids = (selector.match(/#[a-zA-Z_-][\w-]*/g) || []).length;
    classes = (selector.match(/\.[a-zA-Z_-][\w-]*/g) || []).length;
    classes += (selector.match(/\[[^\]]+\]/g) || []).length;
    elements = (selector.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
  }

  return { ids, classes, elements };
}

/**
 * Calculate specificity score as a single number for comparison
 * Using weighted formula: ids * 100 + classes * 10 + elements
 */
export function specificityToScore(specificity: Specificity): number {
  return specificity.ids * 100 + specificity.classes * 10 + specificity.elements;
}

/**
 * Compare two specificities
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  if (a.ids !== b.ids) return a.ids - b.ids;
  if (a.classes !== b.classes) return a.classes - b.classes;
  return a.elements - b.elements;
}

/**
 * Parse a single selector string into ParsedSelector
 */
export function parseSelector(selectorStr: string): ParsedSelector {
  const specificity = calculateSpecificity(selectorStr);
  const depth = calculateSelectorDepth(selectorStr);

  let hasId = false;
  let hasPseudoClass = false;
  let hasPseudoElement = false;
  let hasAttribute = false;

  const processor = selectorParser((selectors) => {
    selectors.walk((node) => {
      switch (node.type) {
        case 'id':
          hasId = true;
          break;
        case 'attribute':
          hasAttribute = true;
          break;
        case 'pseudo':
          if (
            node.value.startsWith('::') ||
            ['before', 'after', 'first-line', 'first-letter', 'selection', 'placeholder'].includes(
              node.value.replace(/^:+/, '')
            )
          ) {
            hasPseudoElement = true;
          } else {
            hasPseudoClass = true;
          }
          break;
      }
    });
  });

  try {
    processor.processSync(selectorStr);
  } catch /* istanbul ignore next - defensive fallback for parser errors */ {
    // Fallback detection using regex when parser fails
    hasId = /#[a-zA-Z_-][\w-]*/.test(selectorStr);
    hasAttribute = /\[[^\]]+\]/.test(selectorStr);
    hasPseudoElement = /::/.test(selectorStr);
    hasPseudoClass = /:(?!:)/.test(selectorStr);
  }

  return {
    raw: selectorStr,
    depth,
    specificity,
    hasId,
    hasPseudoClass,
    hasPseudoElement,
    hasAttribute,
  };
}

/**
 * Parse CSS content and extract rules with their selectors and declarations
 */
export function parseCSS(css: string, filename: string = 'input.css'): ParseResult {
  const rules: ParsedRule[] = [];
  const errors: string[] = [];
  const layers: string[] = [];
  let usesLayers = false;

  let root: Root;
  try {
    root = postcss.parse(css, { from: filename });
  } catch /* istanbul ignore next - defensive error handling for malformed CSS */ (error) {
    /* istanbul ignore next - error type check */
    const message = error instanceof Error ? error.message : String(error);
    return {
      file: filename,
      rules: [],
      errors: [`Failed to parse CSS: ${message}`],
      layers: [],
      usesLayers: false,
    };
  }

  /**
   * Get the layer name for a rule by walking up to find parent @layer
   */
  const getLayerName = (node: Rule): string | undefined => {
    let parent = node.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule') {
        const atRule = parent as AtRule;
        if (atRule.name === 'layer' && atRule.params) {
          return atRule.params.trim();
        }
      }
      parent = parent.parent;
    }
    return undefined;
  };

  const processRule = (rule: Rule, file: string) => {
    const selectors: ParsedSelector[] = [];
    const declarations: ParsedDeclaration[] = [];

    // Parse each selector in the rule
    rule.selectors.forEach((selectorStr) => {
      selectors.push(parseSelector(selectorStr));
    });

    // Parse each declaration
    rule.walkDecls((decl: Declaration) => {
      declarations.push({
        property: decl.prop,
        value: decl.value,
        important: decl.important,
      });
    });

    if (selectors.length > 0) {
      const layer = getLayerName(rule);
      rules.push({
        selectors,
        declarations,
        file,
        line: rule.source?.start?.line,
        column: rule.source?.start?.column,
        layer,
      });
    }
  };

  // First pass: collect all @layer declarations
  root.walkAtRules('layer', (atRule: AtRule) => {
    usesLayers = true;
    const params = atRule.params.trim();
    if (params) {
      // Handle both "@layer name" and "@layer name, name2, name3" syntax
      const layerNames = params.split(',').map((n) => n.trim()).filter(Boolean);
      for (const name of layerNames) {
        if (!layers.includes(name)) {
          layers.push(name);
        }
      }
    }
  });

  // Walk through all rules, including those inside at-rules
  root.walk((node) => {
    if (node.type === 'rule') {
      processRule(node as Rule, filename);
    }
  });

  return {
    file: filename,
    rules,
    errors,
    layers,
    usesLayers,
  };
}

/**
 * Parse CSS from a file path
 */
export async function parseCSSFile(filePath: string): Promise<ParseResult> {
  const fs = await import('fs/promises');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseCSS(content, filePath);
  } catch /* istanbul ignore next - defensive error handling */ (error) {
    /* istanbul ignore next - error type check */
    const message = error instanceof Error ? error.message : String(error);
    return {
      file: filePath,
      rules: [],
      errors: [`Failed to read file: ${message}`],
      layers: [],
      usesLayers: false,
    };
  }
}

/**
 * Combine multiple parse results
 */
export function combineParseResults(results: ParseResult[]): ParseResult[] {
  return results;
}

/**
 * Get all unique property-value pairs from a parse result
 */
export function extractDeclarationPairs(
  result: ParseResult
): Map<string, { count: number; locations: Array<{ file: string; line?: number; selector: string }> }> {
  const pairs = new Map<
    string,
    { count: number; locations: Array<{ file: string; line?: number; selector: string }> }
  >();

  for (const rule of result.rules) {
    for (const decl of rule.declarations) {
      const key = `${decl.property}:${decl.value}`;
      const existing = pairs.get(key);
      /* istanbul ignore next - defensive fallback for empty selectors */
      const location = {
        file: rule.file,
        line: rule.line,
        selector: rule.selectors[0]?.raw || '',
      };

      if (existing) {
        existing.count++;
        existing.locations.push(location);
      } else {
        pairs.set(key, { count: 1, locations: [location] });
      }
    }
  }

  return pairs;
}
