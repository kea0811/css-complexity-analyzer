import {
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
  LAYOUT_PROPERTIES,
  RISKY_COMBINATIONS,
} from './metrics.js';
import { parseCSS } from './parser.js';
import type { ParsedRule, Specificity, ParseResult } from './types.js';

describe('LAYOUT_PROPERTIES', () => {
  it('contains common layout properties', () => {
    expect(LAYOUT_PROPERTIES.has('width')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('height')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('display')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('position')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('margin')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('padding')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('flex')).toBe(true);
    expect(LAYOUT_PROPERTIES.has('grid')).toBe(true);
  });

  it('does not contain non-layout properties', () => {
    expect(LAYOUT_PROPERTIES.has('color')).toBe(false);
    expect(LAYOUT_PROPERTIES.has('background-color')).toBe(false);
  });
});

describe('RISKY_COMBINATIONS', () => {
  it('contains risky property combinations', () => {
    expect(RISKY_COMBINATIONS.length).toBeGreaterThan(0);
    expect(RISKY_COMBINATIONS.some(c => c.properties.includes('position'))).toBe(true);
  });
});

describe('calculateAverage', () => {
  it('returns 0 for empty array', () => {
    expect(calculateAverage([])).toBe(0);
  });

  it('returns the value for single element array', () => {
    expect(calculateAverage([5])).toBe(5);
  });

  it('calculates correct average', () => {
    expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
  });

  it('handles decimal results', () => {
    expect(calculateAverage([1, 2])).toBe(1.5);
  });
});

describe('calculateAverageSpecificity', () => {
  it('returns zero specificity for empty array', () => {
    expect(calculateAverageSpecificity([])).toEqual({ ids: 0, classes: 0, elements: 0 });
  });

  it('returns the specificity for single element', () => {
    const specs: Specificity[] = [{ ids: 1, classes: 2, elements: 3 }];
    expect(calculateAverageSpecificity(specs)).toEqual({ ids: 1, classes: 2, elements: 3 });
  });

  it('calculates correct average', () => {
    const specs: Specificity[] = [
      { ids: 0, classes: 2, elements: 0 },
      { ids: 2, classes: 0, elements: 2 },
    ];
    expect(calculateAverageSpecificity(specs)).toEqual({ ids: 1, classes: 1, elements: 1 });
  });

  it('rounds to 2 decimal places', () => {
    const specs: Specificity[] = [
      { ids: 1, classes: 1, elements: 1 },
      { ids: 0, classes: 0, elements: 0 },
      { ids: 0, classes: 0, elements: 0 },
    ];
    const result = calculateAverageSpecificity(specs);
    expect(result.ids).toBe(0.33);
    expect(result.classes).toBe(0.33);
    expect(result.elements).toBe(0.33);
  });
});

describe('findMaxSpecificity', () => {
  it('returns zero specificity for empty array', () => {
    expect(findMaxSpecificity([])).toEqual({ ids: 0, classes: 0, elements: 0 });
  });

  it('returns the specificity for single element', () => {
    const specs: Specificity[] = [{ ids: 1, classes: 2, elements: 3 }];
    expect(findMaxSpecificity(specs)).toEqual({ ids: 1, classes: 2, elements: 3 });
  });

  it('returns highest specificity (IDs take precedence)', () => {
    const specs: Specificity[] = [
      { ids: 1, classes: 0, elements: 0 },
      { ids: 0, classes: 10, elements: 10 },
    ];
    expect(findMaxSpecificity(specs)).toEqual({ ids: 1, classes: 0, elements: 0 });
  });

  it('compares classes when IDs are equal', () => {
    const specs: Specificity[] = [
      { ids: 0, classes: 3, elements: 0 },
      { ids: 0, classes: 2, elements: 5 },
    ];
    expect(findMaxSpecificity(specs)).toEqual({ ids: 0, classes: 3, elements: 0 });
  });
});

describe('countImportantInRule', () => {
  it('returns 0 for rule with no !important', () => {
    const rule: ParsedRule = {
      selectors: [],
      declarations: [
        { property: 'color', value: 'red', important: false },
        { property: 'background', value: 'blue', important: false },
      ],
      file: 'test.css',
    };
    expect(countImportantInRule(rule)).toBe(0);
  });

  it('counts !important declarations correctly', () => {
    const rule: ParsedRule = {
      selectors: [],
      declarations: [
        { property: 'color', value: 'red', important: true },
        { property: 'background', value: 'blue', important: false },
        { property: 'padding', value: '10px', important: true },
      ],
      file: 'test.css',
    };
    expect(countImportantInRule(rule)).toBe(2);
  });
});

describe('calculateLayoutRiskForDeclarations', () => {
  it('returns 0 for non-layout properties', () => {
    const declarations = [
      { property: 'color', value: 'red', important: false },
      { property: 'background', value: 'blue', important: false },
    ];
    expect(calculateLayoutRiskForDeclarations(declarations)).toBe(0);
  });

  it('adds risk for layout properties', () => {
    const declarations = [
      { property: 'width', value: '100px', important: false },
      { property: 'height', value: '50px', important: false },
    ];
    expect(calculateLayoutRiskForDeclarations(declarations)).toBe(2);
  });

  it('adds extra risk for absolute/fixed positioning', () => {
    const declarations = [
      { property: 'position', value: 'absolute', important: false },
    ];
    expect(calculateLayoutRiskForDeclarations(declarations)).toBe(3); // 1 base + 2 extra
  });

  it('adds extra risk for negative margins', () => {
    const declarations = [
      { property: 'margin-left', value: '-10px', important: false },
    ];
    expect(calculateLayoutRiskForDeclarations(declarations)).toBe(2); // 1 base + 1 extra
  });

  it('applies risk multiplier for risky combinations', () => {
    const declarations = [
      { property: 'position', value: 'absolute', important: false },
      { property: 'top', value: '0', important: false },
      { property: 'left', value: '0', important: false },
    ];
    const risk = calculateLayoutRiskForDeclarations(declarations);
    expect(risk).toBeGreaterThan(3); // Should have multiplier applied
  });
});

describe('calculateFileMetrics', () => {
  it('calculates metrics for simple CSS', () => {
    const css = '.button { color: red; padding: 10px; }';
    const parseResult = parseCSS(css, 'test.css');
    const metrics = calculateFileMetrics(parseResult);

    expect(metrics.file).toBe('test.css');
    expect(metrics.totalRules).toBe(1);
    expect(metrics.totalSelectors).toBe(1);
    expect(metrics.totalDeclarations).toBe(2);
    expect(metrics.maxSelectorDepth).toBe(1);
    expect(metrics.importantCount).toBe(0);
  });

  it('calculates metrics for complex CSS', () => {
    const css = `
      #nav .menu li a { color: red !important; }
      .card .title { font-size: 16px; }
    `;
    const parseResult = parseCSS(css);
    const metrics = calculateFileMetrics(parseResult);

    expect(metrics.totalRules).toBe(2);
    expect(metrics.totalSelectors).toBe(2);
    expect(metrics.maxSelectorDepth).toBe(4);
    expect(metrics.importantCount).toBe(1);
  });

  it('calculates layout risk score', () => {
    const css = '.modal { position: absolute; top: 0; left: 0; width: 100%; }';
    const parseResult = parseCSS(css);
    const metrics = calculateFileMetrics(parseResult);

    expect(metrics.layoutRiskScore).toBeGreaterThan(0);
  });
});

describe('calculateGlobalMetrics', () => {
  it('returns zero metrics for empty array', () => {
    const metrics = calculateGlobalMetrics([]);

    expect(metrics.totalFiles).toBe(0);
    expect(metrics.totalRules).toBe(0);
    expect(metrics.totalSelectors).toBe(0);
    expect(metrics.maxSelectorDepth).toBe(0);
  });

  it('aggregates metrics from multiple files', () => {
    const css1 = '.button { color: red; }';
    const css2 = '.card { background: white; } .modal { display: flex; }';

    const result1 = parseCSS(css1, 'file1.css');
    const result2 = parseCSS(css2, 'file2.css');

    const fileMetrics1 = calculateFileMetrics(result1);
    const fileMetrics2 = calculateFileMetrics(result2);

    const globalMetrics = calculateGlobalMetrics([fileMetrics1, fileMetrics2]);

    expect(globalMetrics.totalFiles).toBe(2);
    expect(globalMetrics.totalRules).toBe(3);
    expect(globalMetrics.totalSelectors).toBe(3);
  });

  it('finds max selector depth across files', () => {
    const css1 = '.a .b .c .d { color: red; }'; // depth 4
    const css2 = '.x .y { color: blue; }'; // depth 2

    const result1 = parseCSS(css1);
    const result2 = parseCSS(css2);

    const fileMetrics1 = calculateFileMetrics(result1);
    const fileMetrics2 = calculateFileMetrics(result2);

    const globalMetrics = calculateGlobalMetrics([fileMetrics1, fileMetrics2]);

    expect(globalMetrics.maxSelectorDepth).toBe(4);
  });
});

describe('extractTopSelectors', () => {
  it('returns empty array for empty input', () => {
    expect(extractTopSelectors([])).toEqual([]);
  });

  it('extracts selectors with scores', () => {
    const css = `
      #nav .menu li a { color: red; }
      .button { color: blue; }
    `;
    const result = parseCSS(css, 'test.css');
    const topSelectors = extractTopSelectors([result], 10);

    expect(topSelectors.length).toBe(2);
    // Higher specificity selector should be first
    expect(topSelectors[0]?.selector).toBe('#nav .menu li a');
  });

  it('respects limit parameter', () => {
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
    `;
    const result = parseCSS(css);
    const topSelectors = extractTopSelectors([result], 2);

    expect(topSelectors.length).toBe(2);
  });

  it('sorts by score descending', () => {
    const css = `
      .simple { color: red; }
      #complex .selector { color: blue; }
    `;
    const result = parseCSS(css);
    const topSelectors = extractTopSelectors([result]);

    expect(topSelectors[0]?.score).toBeGreaterThan(topSelectors[1]?.score ?? 0);
  });
});

describe('detectDuplicateDeclarations', () => {
  it('returns empty map for no duplicates', () => {
    const css = '.a { color: red; } .b { color: blue; }';
    const result = parseCSS(css);
    const duplicates = detectDuplicateDeclarations([result], 2);

    expect(duplicates.size).toBe(0);
  });

  it('detects duplicate declarations', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
    `;
    const result = parseCSS(css);
    const duplicates = detectDuplicateDeclarations([result], 3);

    expect(duplicates.size).toBe(1);
    expect(duplicates.get('color:red')?.count).toBe(3);
  });

  it('normalizes values for comparison', () => {
    const css = `
      .a { color: RED; }
      .b { color: red; }
      .c { color:  red ; }
    `;
    const result = parseCSS(css);
    const duplicates = detectDuplicateDeclarations([result], 3);

    expect(duplicates.size).toBe(1);
  });

  it('tracks locations of duplicates', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
    `;
    const result = parseCSS(css, 'test.css');
    const duplicates = detectDuplicateDeclarations([result], 3);

    const colorDupes = duplicates.get('color:red');
    expect(colorDupes?.locations.length).toBe(3);
    expect(colorDupes?.locations[0]?.file).toBe('test.css');
  });
});

describe('detectDuplicateBlocks', () => {
  it('returns empty array for no duplicate blocks', () => {
    const css = '.a { color: red; } .b { background: blue; }';
    const result = parseCSS(css);
    const blocks = detectDuplicateBlocks([result], 3, 2);

    expect(blocks).toEqual([]);
  });

  it('detects duplicate declaration blocks', () => {
    const css = `
      .a { color: red; background: white; padding: 10px; }
      .b { color: red; background: white; padding: 10px; }
    `;
    const result = parseCSS(css);
    const blocks = detectDuplicateBlocks([result], 3, 2);

    expect(blocks.length).toBeGreaterThan(0);
  });

  it('respects minimum properties threshold', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
    `;
    const result = parseCSS(css);
    const blocks = detectDuplicateBlocks([result], 3, 2);

    // Should not detect because each rule has only 1 property
    expect(blocks.length).toBe(0);
  });
});

describe('detectDuplicateBlocks sorting', () => {
  it('sorts results by occurrence count descending', () => {
    // Create CSS with multiple duplicate blocks of different frequencies
    const css = `
      .a { color: red; background: white; padding: 10px; }
      .b { color: red; background: white; padding: 10px; }
      .c { color: blue; background: gray; padding: 20px; }
      .d { color: blue; background: gray; padding: 20px; }
      .e { color: blue; background: gray; padding: 20px; }
    `;
    const result = parseCSS(css);
    const blocks = detectDuplicateBlocks([result], 3, 2);

    // Should be sorted by occurrence count descending
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i - 1]!.occurrences.length).toBeGreaterThanOrEqual(
        blocks[i]!.occurrences.length
      );
    }
  });

  it('returns multiple duplicate blocks when present', () => {
    const css = `
      .x { margin: 0; padding: 0; border: none; }
      .y { margin: 0; padding: 0; border: none; }
      .z { margin: 0; padding: 0; border: none; }
    `;
    const result = parseCSS(css);
    const blocks = detectDuplicateBlocks([result], 3, 2);

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]?.occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

describe('detectOverridePressure', () => {
  it('returns empty map for few overrides', () => {
    const css = '.a { color: red; } .b { background: blue; }';
    const result = parseCSS(css);
    const pressure = detectOverridePressure([result], 5);

    expect(pressure.size).toBe(0);
  });

  it('detects high override pressure', () => {
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
      .d { color: yellow; }
      .e { color: purple; }
    `;
    const result = parseCSS(css);
    const pressure = detectOverridePressure([result], 5);

    expect(pressure.size).toBe(1);
    expect(pressure.get('color')?.overrideCount).toBe(5);
  });

  it('tracks selector specificity for overridden properties', () => {
    const css = `
      .a { color: red; }
      #b { color: blue; }
      .c.d { color: green; }
      .e { color: yellow; }
      div { color: purple; }
    `;
    const result = parseCSS(css);
    const pressure = detectOverridePressure([result], 5);

    const colorPressure = pressure.get('color');
    expect(colorPressure?.selectors.length).toBe(5);
    expect(colorPressure?.selectors.some(s => s.specificity.ids > 0)).toBe(true);
  });
});
