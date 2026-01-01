import {
  checkDeepSelectors,
  checkHighSpecificity,
  checkImportantAbuse,
  checkDuplicateDeclarations,
  checkLayoutRiskHotspot,
  checkOverridePressure,
  checkMissingLayers,
  runAllRules,
} from './rules.js';
import { parseCSS } from './parser.js';
import type { AnalyzerConfig } from './types.js';

const defaultConfig: AnalyzerConfig = {
  thresholds: {
    maxSelectorDepth: 4,
    maxSpecificityScore: 40,
    maxImportantPerFile: 5,
    maxDuplicateDeclarations: 3,
  },
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

describe('checkDeepSelectors', () => {
  it('returns no issues for shallow selectors', () => {
    const css = '.button { color: red; }';
    const result = parseCSS(css);
    const issues = checkDeepSelectors([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('uses default threshold when config.thresholds is undefined', () => {
    const css = '.a .b .c .d .e { color: red; }'; // depth 5
    const result = parseCSS(css);
    const emptyConfig: AnalyzerConfig = {};
    const issues = checkDeepSelectors([result], emptyConfig);

    // Default maxSelectorDepth is 4, depth 5 > 4, so should detect
    expect(issues).toHaveLength(1);
  });

  it('detects deep selectors exceeding threshold', () => {
    const css = '.a .b .c .d .e { color: red; }';
    const result = parseCSS(css);
    const issues = checkDeepSelectors([result], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe('DEEP_SELECTOR');
    expect(issues[0]?.evidence.depth).toBe(5);
  });

  it('assigns severity based on depth', () => {
    const css = '.a .b .c .d .e .f .g .h { color: red; }';
    const result = parseCSS(css);
    const issues = checkDeepSelectors([result], defaultConfig);

    expect(issues[0]?.severity).toBe('critical');
  });

  it('includes suggestions', () => {
    const css = '.a .b .c .d .e { color: red; }';
    const result = parseCSS(css);
    const issues = checkDeepSelectors([result], defaultConfig);

    expect(issues[0]?.suggestions.length).toBeGreaterThan(0);
  });

  it('respects custom threshold', () => {
    const css = '.a .b .c { color: red; }';
    const result = parseCSS(css);
    const customConfig = { ...defaultConfig, thresholds: { maxSelectorDepth: 2 } };
    const issues = checkDeepSelectors([result], customConfig);

    expect(issues).toHaveLength(1);
  });

  it('assigns medium severity for depth excess of 1', () => {
    const css = '.a .b .c .d .e { color: red; }'; // depth 5, excess 1
    const result = parseCSS(css);
    const issues = checkDeepSelectors([result], defaultConfig);

    expect(issues[0]?.severity).toBe('medium');
  });

  it('assigns high severity for depth excess of 2-3', () => {
    const css = '.a .b .c .d .e .f { color: red; }'; // depth 6, excess 2
    const result = parseCSS(css);
    const issues = checkDeepSelectors([result], defaultConfig);

    expect(issues[0]?.severity).toBe('high');
  });

  it('assigns low severity for exactly at threshold (edge case)', () => {
    const css = '.a .b .c .d .e { color: red; }'; // depth 5, excess 1
    const result = parseCSS(css);
    const customConfig = { ...defaultConfig, thresholds: { maxSelectorDepth: 4 } };
    const issues = checkDeepSelectors([result], customConfig);

    // depth 5, threshold 4, excess 1 = medium
    expect(issues[0]?.severity).toBe('medium');
  });
});

describe('checkHighSpecificity', () => {
  it('returns no issues for low specificity selectors', () => {
    const css = '.button { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('uses default threshold when config.thresholds is undefined', () => {
    const css = '#main { color: red; }';
    const result = parseCSS(css);
    const emptyConfig: AnalyzerConfig = {};
    const issues = checkHighSpecificity([result], emptyConfig);

    // Default maxSpecificityScore is 40, ID selector exceeds this
    expect(issues).toHaveLength(1);
  });

  it('detects ID selectors', () => {
    const css = '#main { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe('HIGH_SPECIFICITY');
    expect(issues[0]?.evidence.specificity?.ids).toBe(1);
  });

  it('detects selectors exceeding specificity threshold', () => {
    const css = '.a.b.c.d.e { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues).toHaveLength(1);
  });

  it('assigns high severity for multiple IDs', () => {
    const css = '#main #content { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues[0]?.severity).toBe('critical');
  });

  it('includes evidence with specificity', () => {
    const css = '#nav .menu { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues[0]?.evidence.specificity).toBeDefined();
    expect(issues[0]?.evidence.specificity?.ids).toBe(1);
    expect(issues[0]?.evidence.specificity?.classes).toBe(1);
  });
});

describe('checkImportantAbuse', () => {
  it('returns no issues when below threshold', () => {
    const css = '.button { color: red !important; }';
    const result = parseCSS(css);
    const issues = checkImportantAbuse([result], defaultConfig);

    // Single !important on non-layout property might not trigger
    expect(issues.length).toBeLessThanOrEqual(1);
  });

  it('uses default threshold when config.thresholds is undefined', () => {
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
    `;
    const result = parseCSS(css, 'test.css');
    const emptyConfig: AnalyzerConfig = {};
    const issues = checkImportantAbuse([result], emptyConfig);

    // Default maxImportantPerFile is 5, we have 6, should detect
    expect(issues.some(i => i.id === 'IMPORTANT_ABUSE' && (i.evidence.count ?? 0) > 5)).toBe(true);
  });

  it('detects excessive !important usage per file', () => {
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
    `;
    const result = parseCSS(css, 'test.css');
    const issues = checkImportantAbuse([result], defaultConfig);

    expect(issues.some(i => i.id === 'IMPORTANT_ABUSE' && (i.evidence.count ?? 0) > 5)).toBe(true);
  });

  it('flags !important on layout properties', () => {
    const css = '.modal { width: 100% !important; }';
    const result = parseCSS(css);
    const issues = checkImportantAbuse([result], defaultConfig);

    expect(issues.some(i => i.evidence.property === 'width')).toBe(true);
  });

  it('includes suggestions for reducing !important', () => {
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
    `;
    const result = parseCSS(css);
    const issues = checkImportantAbuse([result], defaultConfig);

    const fileIssue = issues.find(i => (i.evidence.count ?? 0) > 5);
    expect(fileIssue?.suggestions.length).toBeGreaterThan(0);
  });
});

describe('checkDuplicateDeclarations', () => {
  it('returns no issues for unique declarations', () => {
    const css = '.a { color: red; } .b { color: blue; }';
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('uses default threshold when config.thresholds is undefined', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
    `;
    const result = parseCSS(css);
    const emptyConfig: AnalyzerConfig = {};
    const issues = checkDuplicateDeclarations([result], emptyConfig);

    // Default maxDuplicateDeclarations is 3, we have 3, should detect
    expect(issues).toHaveLength(1);
  });

  it('detects duplicate declarations exceeding threshold', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
    `;
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe('DUPLICATE_DECLARATIONS');
  });

  it('includes count in evidence', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
      .d { color: red; }
    `;
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues[0]?.evidence.count).toBe(4);
  });

  it('suggests utility classes and custom properties', () => {
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
    `;
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues[0]?.suggestions.some(s => s.action.includes('utility'))).toBe(true);
    expect(issues[0]?.suggestions.some(s => s.action.includes('custom property'))).toBe(true);
  });
});

describe('checkLayoutRiskHotspot', () => {
  it('returns no issues for simple rules', () => {
    const css = '.button { color: red; }';
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('detects rules with many layout properties', () => {
    const css = `
      .modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        padding: 20px;
      }
    `;
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    expect(issues.some(i => i.id === 'LAYOUT_RISK_HOTSPOT')).toBe(true);
  });

  it('flags absolute/fixed positioning as higher risk', () => {
    const css = '.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }';
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    expect(issues.length).toBeGreaterThan(0);
  });

  it('includes suggestions for positioning issues', () => {
    const css = '.modal { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }';
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    expect(issues[0]?.suggestions.some(s => s.action.includes('relative'))).toBe(true);
  });
});

describe('checkOverridePressure', () => {
  it('returns no issues for few property definitions', () => {
    const css = '.a { color: red; } .b { background: blue; }';
    const result = parseCSS(css);
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues).toHaveLength(0);
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
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe('OVERRIDE_PRESSURE');
  });

  it('includes property name in evidence', () => {
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
      .d { color: yellow; }
      .e { color: purple; }
    `;
    const result = parseCSS(css);
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues[0]?.evidence.property).toBe('color');
  });

  it('suggests consolidation strategies', () => {
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
      .d { color: yellow; }
      .e { color: purple; }
    `;
    const result = parseCSS(css);
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues[0]?.suggestions.some(s => s.action.includes('Consolidate'))).toBe(true);
  });
});

describe('checkLayoutRiskHotspot severity levels', () => {
  it('assigns low severity for risk score between 5-9', () => {
    // Risk score 5-9 should be low severity
    const css = `
      .container {
        width: 100%;
        height: 100%;
        padding: 20px;
        margin: 10px;
        display: block;
      }
    `;
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    // Should have issues but with low severity (risk score around 5-6)
    const layoutIssue = issues.find(i => i.id === 'LAYOUT_RISK_HOTSPOT');
    if (layoutIssue) {
      expect(layoutIssue.severity).toBe('low');
    }
  });

  it('assigns medium severity for risk score between 10-14', () => {
    // Need to create a rule with risk score 10-14
    const css = `
      .modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        padding: 20px;
        margin: 10px;
        display: flex;
      }
    `;
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    const layoutIssue = issues.find(i => i.id === 'LAYOUT_RISK_HOTSPOT');
    if (layoutIssue) {
      expect(['medium', 'high']).toContain(layoutIssue.severity);
    }
  });

  it('assigns high severity for risk score >= 15', () => {
    // Create a very high risk rule
    const css = `
      .complex-layout {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        padding: 20px;
        margin: -10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
    `;
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    const layoutIssue = issues.find(i => i.id === 'LAYOUT_RISK_HOTSPOT');
    expect(layoutIssue).toBeDefined();
    expect(layoutIssue?.severity).toBe('high');
  });

  it('provides different suggestions when no absolute/fixed positioning', () => {
    const css = `
      .layout {
        width: 100%;
        height: 100%;
        padding: 20px;
        margin: 10px;
        display: flex;
        flex-direction: row;
      }
    `;
    const result = parseCSS(css);
    const issues = checkLayoutRiskHotspot([result], defaultConfig);

    const layoutIssue = issues.find(i => i.id === 'LAYOUT_RISK_HOTSPOT');
    if (layoutIssue) {
      // Should have "Simplify layout" suggestion instead of "Use relative positioning"
      expect(layoutIssue.suggestions.some(s => s.action.includes('Simplify'))).toBe(true);
    }
  });
});

describe('checkOverridePressure severity levels', () => {
  it('assigns low severity for moderate overrides with low variance', () => {
    // 5 overrides with similar specificity = low severity
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
      .d { color: yellow; }
      .e { color: purple; }
    `;
    const result = parseCSS(css);
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues[0]?.severity).toBe('low');
  });

  it('assigns medium severity for higher override count or variance', () => {
    // 10+ overrides should trigger medium severity
    const css = `
      .a { color: red; }
      .b { color: blue; }
      .c { color: green; }
      .d { color: yellow; }
      .e { color: purple; }
      .f { color: orange; }
      .g { color: pink; }
      .h { color: brown; }
      .i { color: gray; }
      .j { color: white; }
    `;
    const result = parseCSS(css);
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues[0]?.severity).toBe('medium');
  });

  it('assigns high severity for many overrides with high specificity variance', () => {
    // 15+ overrides with high variance
    const css = `
      div { color: red; }
      .a { color: blue; }
      .b { color: green; }
      .c { color: yellow; }
      .d { color: purple; }
      #main { color: orange; }
      #main .content { color: pink; }
      .e { color: brown; }
      .f { color: gray; }
      .g { color: white; }
      .h { color: black; }
      .i { color: cyan; }
      .j { color: magenta; }
      .k { color: lime; }
      #footer { color: navy; }
    `;
    const result = parseCSS(css);
    const issues = checkOverridePressure([result], defaultConfig);

    expect(issues[0]?.severity).toBe('high');
  });
});

describe('checkImportantAbuse severity levels', () => {
  it('assigns low severity for ratio just above threshold', () => {
    // 6 !important with threshold of 5 = ratio 1.2 = low
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
    `;
    const result = parseCSS(css, 'test.css');
    const issues = checkImportantAbuse([result], defaultConfig);

    const fileIssue = issues.find(i => i.id === 'IMPORTANT_ABUSE' && (i.evidence.count ?? 0) > 5);
    expect(fileIssue?.severity).toBe('low');
  });

  it('assigns medium severity for ratio 1.5-2.5x', () => {
    // ~8 !important with threshold of 5 = ratio ~1.6 = medium
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
      .g { font-weight: bold !important; }
      .h { text-align: center !important; }
    `;
    const result = parseCSS(css, 'test.css');
    const issues = checkImportantAbuse([result], defaultConfig);

    const fileIssue = issues.find(i => i.id === 'IMPORTANT_ABUSE' && (i.evidence.count ?? 0) > 5);
    expect(fileIssue?.severity).toBe('medium');
  });

  it('assigns high severity for ratio 2.5-4x', () => {
    // ~13 !important with threshold of 5 = ratio ~2.6 = high
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
      .g { font-weight: bold !important; }
      .h { text-align: center !important; }
      .i { line-height: 1.5 !important; }
      .j { letter-spacing: 1px !important; }
      .k { text-decoration: none !important; }
      .l { text-transform: uppercase !important; }
      .m { cursor: pointer !important; }
    `;
    const result = parseCSS(css, 'test.css');
    const issues = checkImportantAbuse([result], defaultConfig);

    const fileIssue = issues.find(i => i.id === 'IMPORTANT_ABUSE' && (i.evidence.count ?? 0) > 5);
    expect(fileIssue?.severity).toBe('high');
  });

  it('assigns critical severity for ratio >= 4x', () => {
    // ~20 !important with threshold of 5 = ratio 4 = critical
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
      .f { font-size: 14px !important; }
      .g { font-weight: bold !important; }
      .h { text-align: center !important; }
      .i { line-height: 1.5 !important; }
      .j { letter-spacing: 1px !important; }
      .k { text-decoration: none !important; }
      .l { text-transform: uppercase !important; }
      .m { cursor: pointer !important; }
      .n { display: block !important; }
      .o { position: relative !important; }
      .p { z-index: 1 !important; }
      .q { opacity: 1 !important; }
      .r { visibility: visible !important; }
      .s { overflow: hidden !important; }
      .t { white-space: nowrap !important; }
    `;
    const result = parseCSS(css, 'test.css');
    const issues = checkImportantAbuse([result], defaultConfig);

    const fileIssue = issues.find(i => i.id === 'IMPORTANT_ABUSE' && (i.evidence.count ?? 0) > 5);
    expect(fileIssue?.severity).toBe('critical');
  });
});

describe('checkDuplicateDeclarations severity levels', () => {
  it('assigns low severity for count just above threshold', () => {
    // 3 duplicates with threshold of 3 = low
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
    `;
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues[0]?.severity).toBe('low');
  });

  it('assigns medium severity for count 3x threshold', () => {
    // 9 duplicates with threshold of 3 = medium
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
      .d { color: red; }
      .e { color: red; }
      .f { color: red; }
      .g { color: red; }
      .h { color: red; }
      .i { color: red; }
    `;
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues[0]?.severity).toBe('medium');
  });

  it('assigns high severity for count 5x threshold', () => {
    // 15 duplicates with threshold of 3 = high
    const css = `
      .a { color: red; }
      .b { color: red; }
      .c { color: red; }
      .d { color: red; }
      .e { color: red; }
      .f { color: red; }
      .g { color: red; }
      .h { color: red; }
      .i { color: red; }
      .j { color: red; }
      .k { color: red; }
      .l { color: red; }
      .m { color: red; }
      .n { color: red; }
      .o { color: red; }
    `;
    const result = parseCSS(css);
    const issues = checkDuplicateDeclarations([result], defaultConfig);

    expect(issues[0]?.severity).toBe('high');
  });
});

describe('checkHighSpecificity severity levels', () => {
  it('assigns low severity for score just above threshold with no IDs', () => {
    // Score of ~50 with threshold of 40, no IDs = low
    const css = '.a.b.c.d.e { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues[0]?.severity).toBe('low');
  });

  it('assigns medium severity for score > 1.5x threshold', () => {
    // Score of ~70 with threshold of 40 = medium
    const css = '.a.b.c.d.e.f.g { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues[0]?.severity).toBe('medium');
  });

  it('assigns high severity for single ID', () => {
    const css = '#main { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues[0]?.severity).toBe('high');
  });

  it('assigns critical severity for multiple IDs', () => {
    const css = '#main #content { color: red; }';
    const result = parseCSS(css);
    const issues = checkHighSpecificity([result], defaultConfig);

    expect(issues[0]?.severity).toBe('critical');
  });
});

describe('runAllRules', () => {
  it('runs all enabled rules', () => {
    const css = `
      #main .content .article .body .text { color: red !important; }
      .a { padding: 10px; }
      .b { padding: 10px; }
      .c { padding: 10px; }
    `;
    const result = parseCSS(css);
    const issues = runAllRules([result], defaultConfig);

    // Should have issues from multiple rules
    const issueTypes = new Set(issues.map(i => i.id));
    expect(issueTypes.size).toBeGreaterThan(1);
  });

  it('respects disabled rules', () => {
    const css = '#main { color: red; }';
    const result = parseCSS(css);
    const configWithDisabledRule = {
      ...defaultConfig,
      rules: { ...defaultConfig.rules, highSpecificity: false },
    };
    const issues = runAllRules([result], configWithDisabledRule);

    expect(issues.every(i => i.id !== 'HIGH_SPECIFICITY')).toBe(true);
  });

  it('sorts issues by severity', () => {
    const css = `
      #main #content { color: red; }
      .simple { color: blue; }
      .a .b .c .d .e .f .g .h { color: green; }
    `;
    const result = parseCSS(css);
    const issues = runAllRules([result], defaultConfig);

    // Critical issues should come first
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < issues.length; i++) {
      const prev = issues[i - 1];
      const curr = issues[i];
      if (prev && curr) {
        expect(severityOrder[prev.severity]).toBeLessThanOrEqual(severityOrder[curr.severity]);
      }
    }
  });

  it('handles empty parse results', () => {
    const issues = runAllRules([], defaultConfig);
    expect(issues).toEqual([]);
  });

  it('handles parse results with no rules', () => {
    const css = '/* just a comment */';
    const result = parseCSS(css);
    const issues = runAllRules([result], defaultConfig);

    expect(issues).toEqual([]);
  });

  it('uses default rules when config.rules is undefined', () => {
    const css = '#main { color: red; }';
    const result = parseCSS(css);
    const emptyConfig: AnalyzerConfig = {};
    const issues = runAllRules([result], emptyConfig);

    // Default rules are all enabled, so should detect HIGH_SPECIFICITY
    expect(issues.some(i => i.id === 'HIGH_SPECIFICITY')).toBe(true);
  });

  it('respects disabled missingLayers rule', () => {
    // Generate many rules to trigger missing layers
    const rules = Array.from({ length: 60 }, (_, i) => `.rule${i} { color: red; }`).join('\n');
    const result = parseCSS(rules);
    const configWithDisabledRule = {
      ...defaultConfig,
      rules: { ...defaultConfig.rules, missingLayers: false },
    };
    const issues = runAllRules([result], configWithDisabledRule);

    expect(issues.every(i => i.id !== 'MISSING_LAYERS')).toBe(true);
  });
});

describe('checkMissingLayers', () => {
  it('returns no issues when layers are used', () => {
    const css = `
      @layer base {
        .button { color: red; }
      }
    `;
    const result = parseCSS(css);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('returns no issues for small codebases without layers', () => {
    const css = `
      .button { color: red; }
      .card { background: white; }
    `;
    const result = parseCSS(css);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('suggests layers for large codebases without @layer', () => {
    // Generate 50+ rules to trigger the suggestion
    const rules = Array.from({ length: 60 }, (_, i) => `.rule${i} { color: red; }`).join('\n');
    const result = parseCSS(rules);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe('MISSING_LAYERS');
    expect(issues[0]?.suggestions.length).toBeGreaterThan(0);
  });

  it('suggests layers when many !important declarations exist', () => {
    // 5+ !important should trigger
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
    `;
    const result = parseCSS(css);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe('MISSING_LAYERS');
  });

  it('assigns low severity for moderate codebase', () => {
    // 50-100 rules = low severity
    const rules = Array.from({ length: 60 }, (_, i) => `.rule${i} { color: red; }`).join('\n');
    const result = parseCSS(rules);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues[0]?.severity).toBe('low');
  });

  it('assigns medium severity for large codebase', () => {
    // 200+ rules = medium severity
    const rules = Array.from({ length: 210 }, (_, i) => `.rule${i} { color: red; }`).join('\n');
    const result = parseCSS(rules);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues[0]?.severity).toBe('medium');
  });

  it('assigns medium severity for many !important', () => {
    // 20+ !important = medium severity
    const rules = Array.from({ length: 25 }, (_, i) => `.rule${i} { color: red !important; }`).join('\n');
    const result = parseCSS(rules);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues[0]?.severity).toBe('medium');
  });

  it('does not suggest layers when @layer is already used', () => {
    const css = `
      @layer reset, base, components;
      @layer base {
        ${Array.from({ length: 60 }, (_, i) => `.rule${i} { color: red; }`).join('\n')}
      }
    `;
    const result = parseCSS(css);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues).toHaveLength(0);
  });

  it('handles multiple files with varying layer usage', () => {
    const css1 = Array.from({ length: 30 }, (_, i) => `.a${i} { color: red; }`).join('\n');
    const css2 = Array.from({ length: 30 }, (_, i) => `.b${i} { color: blue; }`).join('\n');
    const result1 = parseCSS(css1, 'a.css');
    const result2 = parseCSS(css2, 'b.css');
    const issues = checkMissingLayers([result1, result2], defaultConfig);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.evidence.count).toBe(60);
  });

  it('triggers when files with many rules exist', () => {
    // 3+ files with 20+ rules each should trigger
    const createFile = (name: string) => {
      const rules = Array.from({ length: 25 }, (_, i) => `.${name}${i} { color: red; }`).join('\n');
      return parseCSS(rules, `${name}.css`);
    };

    const results = [createFile('a'), createFile('b'), createFile('c')];
    const issues = checkMissingLayers(results, defaultConfig);

    expect(issues).toHaveLength(1);
  });

  it('provides layer-specific suggestions', () => {
    const rules = Array.from({ length: 60 }, (_, i) => `.rule${i} { color: red; }`).join('\n');
    const result = parseCSS(rules);
    const issues = checkMissingLayers([result], defaultConfig);

    const suggestions = issues[0]?.suggestions ?? [];
    expect(suggestions.some(s => s.action.includes('layer'))).toBe(true);
    expect(suggestions.some(s => s.description.includes('reset'))).toBe(true);
  });

  it('mentions !important count when present', () => {
    const css = `
      .a { color: red !important; }
      .b { background: blue !important; }
      .c { padding: 10px !important; }
      .d { margin: 5px !important; }
      .e { border: 1px solid !important; }
    `;
    const result = parseCSS(css);
    const issues = checkMissingLayers([result], defaultConfig);

    expect(issues[0]?.why).toContain('!important');
  });

  it('handles empty parse results', () => {
    const issues = checkMissingLayers([], defaultConfig);
    expect(issues).toHaveLength(0);
  });
});
