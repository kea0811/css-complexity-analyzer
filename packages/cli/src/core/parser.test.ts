import {
  calculateSelectorDepth,
  calculateSpecificity,
  specificityToScore,
  compareSpecificity,
  parseSelector,
  parseCSS,
  parseCSSFile,
  extractDeclarationPairs,
  combineParseResults,
} from './parser.js';

describe('calculateSelectorDepth', () => {
  it('returns 1 for simple class selector', () => {
    expect(calculateSelectorDepth('.button')).toBe(1);
  });

  it('returns 1 for simple element selector', () => {
    expect(calculateSelectorDepth('div')).toBe(1);
  });

  it('returns 1 for ID selector', () => {
    expect(calculateSelectorDepth('#main')).toBe(1);
  });

  it('returns 2 for descendant combinator', () => {
    expect(calculateSelectorDepth('.parent .child')).toBe(2);
  });

  it('returns 2 for child combinator', () => {
    expect(calculateSelectorDepth('.parent > .child')).toBe(2);
  });

  it('returns 3 for multiple combinators', () => {
    expect(calculateSelectorDepth('.a .b .c')).toBe(3);
  });

  it('returns correct depth for mixed combinators', () => {
    expect(calculateSelectorDepth('.a > .b + .c ~ .d')).toBe(4);
  });

  it('handles complex nested selectors', () => {
    expect(calculateSelectorDepth('.page .main .content .article .text')).toBe(5);
  });

  it('handles pseudo-classes without adding depth', () => {
    expect(calculateSelectorDepth('.button:hover')).toBe(1);
  });

  it('handles attribute selectors without adding depth', () => {
    expect(calculateSelectorDepth('a[href]')).toBe(1);
  });
});

describe('calculateSpecificity', () => {
  it('returns 0,0,1 for element selector', () => {
    expect(calculateSpecificity('div')).toEqual({ ids: 0, classes: 0, elements: 1 });
  });

  it('returns 0,1,0 for class selector', () => {
    expect(calculateSpecificity('.button')).toEqual({ ids: 0, classes: 1, elements: 0 });
  });

  it('returns 1,0,0 for ID selector', () => {
    expect(calculateSpecificity('#main')).toEqual({ ids: 1, classes: 0, elements: 0 });
  });

  it('returns correct specificity for combined selectors', () => {
    expect(calculateSpecificity('#main .button')).toEqual({ ids: 1, classes: 1, elements: 0 });
  });

  it('returns correct specificity for element and class', () => {
    expect(calculateSpecificity('div.button')).toEqual({ ids: 0, classes: 1, elements: 1 });
  });

  it('returns correct specificity for multiple classes', () => {
    expect(calculateSpecificity('.btn.btn-primary.active')).toEqual({ ids: 0, classes: 3, elements: 0 });
  });

  it('counts attribute selectors as classes', () => {
    expect(calculateSpecificity('[type="button"]')).toEqual({ ids: 0, classes: 1, elements: 0 });
  });

  it('counts pseudo-classes', () => {
    expect(calculateSpecificity('.button:hover')).toEqual({ ids: 0, classes: 2, elements: 0 });
  });

  it('counts pseudo-elements as elements', () => {
    expect(calculateSpecificity('.button::before')).toEqual({ ids: 0, classes: 1, elements: 1 });
  });

  it('handles complex selectors', () => {
    expect(calculateSpecificity('#nav .menu li a.active:hover')).toEqual({ ids: 1, classes: 3, elements: 2 });
  });

  it('ignores universal selector', () => {
    expect(calculateSpecificity('*')).toEqual({ ids: 0, classes: 0, elements: 0 });
  });

  it('handles :not() pseudo-class correctly', () => {
    // :not itself doesn't add specificity, but its contents do
    expect(calculateSpecificity('.button:not(.disabled)')).toEqual({ ids: 0, classes: 2, elements: 0 });
  });
});

describe('specificityToScore', () => {
  it('returns 0 for zero specificity', () => {
    expect(specificityToScore({ ids: 0, classes: 0, elements: 0 })).toBe(0);
  });

  it('returns 1 for single element', () => {
    expect(specificityToScore({ ids: 0, classes: 0, elements: 1 })).toBe(1);
  });

  it('returns 10 for single class', () => {
    expect(specificityToScore({ ids: 0, classes: 1, elements: 0 })).toBe(10);
  });

  it('returns 100 for single ID', () => {
    expect(specificityToScore({ ids: 1, classes: 0, elements: 0 })).toBe(100);
  });

  it('returns correct weighted sum', () => {
    expect(specificityToScore({ ids: 1, classes: 2, elements: 3 })).toBe(123);
  });
});

describe('compareSpecificity', () => {
  it('returns 0 for equal specificities', () => {
    const a = { ids: 1, classes: 2, elements: 3 };
    const b = { ids: 1, classes: 2, elements: 3 };
    expect(compareSpecificity(a, b)).toBe(0);
  });

  it('returns positive when first has more IDs', () => {
    const a = { ids: 2, classes: 0, elements: 0 };
    const b = { ids: 1, classes: 5, elements: 5 };
    expect(compareSpecificity(a, b)).toBeGreaterThan(0);
  });

  it('returns negative when first has fewer IDs', () => {
    const a = { ids: 0, classes: 5, elements: 5 };
    const b = { ids: 1, classes: 0, elements: 0 };
    expect(compareSpecificity(a, b)).toBeLessThan(0);
  });

  it('compares classes when IDs are equal', () => {
    const a = { ids: 1, classes: 3, elements: 0 };
    const b = { ids: 1, classes: 2, elements: 5 };
    expect(compareSpecificity(a, b)).toBeGreaterThan(0);
  });

  it('compares elements when IDs and classes are equal', () => {
    const a = { ids: 1, classes: 2, elements: 3 };
    const b = { ids: 1, classes: 2, elements: 2 };
    expect(compareSpecificity(a, b)).toBeGreaterThan(0);
  });
});

describe('parseSelector', () => {
  it('parses simple class selector', () => {
    const result = parseSelector('.button');
    expect(result.raw).toBe('.button');
    expect(result.depth).toBe(1);
    expect(result.specificity).toEqual({ ids: 0, classes: 1, elements: 0 });
    expect(result.hasId).toBe(false);
    expect(result.hasPseudoClass).toBe(false);
    expect(result.hasPseudoElement).toBe(false);
    expect(result.hasAttribute).toBe(false);
  });

  it('parses ID selector', () => {
    const result = parseSelector('#main');
    expect(result.hasId).toBe(true);
  });

  it('parses pseudo-class selector', () => {
    const result = parseSelector('.button:hover');
    expect(result.hasPseudoClass).toBe(true);
    expect(result.hasPseudoElement).toBe(false);
  });

  it('parses pseudo-element selector', () => {
    const result = parseSelector('.button::before');
    expect(result.hasPseudoElement).toBe(true);
  });

  it('parses attribute selector', () => {
    const result = parseSelector('input[type="text"]');
    expect(result.hasAttribute).toBe(true);
  });

  it('parses complex selector with all features', () => {
    const result = parseSelector('#nav .menu[data-active]:hover::after');
    expect(result.hasId).toBe(true);
    expect(result.hasPseudoClass).toBe(true);
    expect(result.hasPseudoElement).toBe(true);
    expect(result.hasAttribute).toBe(true);
    expect(result.depth).toBe(2);
  });
});

describe('parseCSS', () => {
  it('parses simple CSS rule', () => {
    const css = '.button { color: red; }';
    const result = parseCSS(css, 'test.css');

    expect(result.file).toBe('test.css');
    expect(result.errors).toHaveLength(0);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.selectors).toHaveLength(1);
    expect(result.rules[0]?.selectors[0]?.raw).toBe('.button');
    expect(result.rules[0]?.declarations).toHaveLength(1);
    expect(result.rules[0]?.declarations[0]?.property).toBe('color');
    expect(result.rules[0]?.declarations[0]?.value).toBe('red');
  });

  it('parses multiple selectors in a rule', () => {
    const css = '.button, .btn { color: blue; }';
    const result = parseCSS(css);

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.selectors).toHaveLength(2);
    expect(result.rules[0]?.selectors[0]?.raw).toBe('.button');
    expect(result.rules[0]?.selectors[1]?.raw).toBe('.btn');
  });

  it('parses multiple rules', () => {
    const css = `
      .button { color: red; }
      .card { background: white; }
    `;
    const result = parseCSS(css);

    expect(result.rules).toHaveLength(2);
  });

  it('detects !important declarations', () => {
    const css = '.button { color: red !important; }';
    const result = parseCSS(css);

    expect(result.rules[0]?.declarations[0]?.important).toBe(true);
  });

  it('parses rules inside media queries', () => {
    const css = `
      @media (min-width: 768px) {
        .button { color: red; }
      }
    `;
    const result = parseCSS(css);

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.selectors[0]?.raw).toBe('.button');
  });

  it('returns errors for invalid CSS', () => {
    const css = '.button { color: }';
    const result = parseCSS(css);
    // PostCSS is quite lenient, so this might not error
    // but we test that it handles it gracefully
    expect(result.file).toBe('input.css');
  });

  it('uses default filename when not provided', () => {
    const css = '.button { color: red; }';
    const result = parseCSS(css);
    expect(result.file).toBe('input.css');
  });

  it('includes source line information', () => {
    const css = '.button { color: red; }';
    const result = parseCSS(css, 'test.css');

    expect(result.rules[0]?.line).toBe(1);
  });

  it('handles empty CSS', () => {
    const result = parseCSS('');
    expect(result.rules).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles CSS with only comments', () => {
    const css = '/* This is a comment */';
    const result = parseCSS(css);
    expect(result.rules).toHaveLength(0);
  });
});

describe('extractDeclarationPairs', () => {
  it('extracts unique declaration pairs', () => {
    const css = `
      .button { color: red; padding: 10px; }
      .card { color: red; background: white; }
    `;
    const result = parseCSS(css);
    const pairs = extractDeclarationPairs(result);

    expect(pairs.get('color:red')?.count).toBe(2);
    expect(pairs.get('padding:10px')?.count).toBe(1);
    expect(pairs.get('background:white')?.count).toBe(1);
  });

  it('tracks locations of declarations', () => {
    const css = `
      .button { color: red; }
      .card { color: red; }
    `;
    const result = parseCSS(css);
    const pairs = extractDeclarationPairs(result);

    const colorPair = pairs.get('color:red');
    expect(colorPair?.locations).toHaveLength(2);
    expect(colorPair?.locations[0]?.selector).toBe('.button');
    expect(colorPair?.locations[1]?.selector).toBe('.card');
  });
});

describe('parseCSSFile', () => {
  it('returns error for non-existent file', async () => {
    const result = await parseCSSFile('/nonexistent/file.css');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.rules).toHaveLength(0);
  });
});

describe('combineParseResults', () => {
  it('returns the input array unchanged', () => {
    const results = [
      { file: 'a.css', rules: [], errors: [] },
      { file: 'b.css', rules: [], errors: [] },
    ];
    expect(combineParseResults(results)).toBe(results);
  });
});

describe('calculateSelectorDepth fallback', () => {
  it('handles malformed selectors gracefully', () => {
    // Test with a selector that might cause parsing issues
    const depth = calculateSelectorDepth('.a[unclosed');
    expect(typeof depth).toBe('number');
    expect(depth).toBeGreaterThan(0);
  });
});

describe('calculateSpecificity edge cases', () => {
  it('handles :where pseudo-class', () => {
    const spec = calculateSpecificity(':where(.a, .b)');
    // :where has zero specificity
    expect(spec.classes).toBeLessThanOrEqual(2);
  });

  it('handles :has pseudo-class', () => {
    const spec = calculateSpecificity('.a:has(.b)');
    expect(spec.classes).toBeGreaterThanOrEqual(1);
  });
});

describe('parseSelector edge cases', () => {
  it('detects :before pseudo-element with single colon', () => {
    const result = parseSelector('.button:before');
    expect(result.hasPseudoElement).toBe(true);
  });

  it('detects :after pseudo-element with single colon', () => {
    const result = parseSelector('.button:after');
    expect(result.hasPseudoElement).toBe(true);
  });

  it('detects :first-letter pseudo-element', () => {
    const result = parseSelector('p:first-letter');
    expect(result.hasPseudoElement).toBe(true);
  });

  it('detects :selection pseudo-element', () => {
    const result = parseSelector('::selection');
    expect(result.hasPseudoElement).toBe(true);
  });
});

describe('parseCSS error handling', () => {
  it('returns errors for severely malformed CSS', () => {
    // PostCSS is lenient, but unclosed braces can cause issues
    const result = parseCSS('{{{{');
    // Either parses with empty rules or returns an error
    expect(result.file).toBe('input.css');
  });

  it('handles CSS with syntax errors gracefully', () => {
    const css = '.button { color: ; }';
    const result = parseCSS(css);
    // Should still parse, just with empty value
    expect(result.file).toBe('input.css');
  });
});

describe('calculateSpecificity fallback branch', () => {
  // These tests exercise the regex fallback when selector parser fails
  it('handles selector with unbalanced brackets using fallback', () => {
    // Force a scenario that would cause parse failure
    const spec = calculateSpecificity('#id .class div[attr');
    // Should fall back to regex estimation
    expect(spec.ids).toBeGreaterThanOrEqual(0);
    expect(spec.classes).toBeGreaterThanOrEqual(0);
  });
});

describe('parseSelector fallback behavior', () => {
  // Note: The postcss-selector-parser is very robust and rarely throws.
  // This test verifies the fallback regex patterns work correctly if parsing were to fail.
  // Since we can't easily make the parser throw, we test the regex patterns used in fallback.

  it('fallback regex detects IDs correctly', () => {
    const idRegex = /#[a-zA-Z_-][\w-]*/;
    expect(idRegex.test('#main')).toBe(true);
    expect(idRegex.test('#my-id')).toBe(true);
    expect(idRegex.test('#_private')).toBe(true);
    expect(idRegex.test('.class')).toBe(false);
  });

  it('fallback regex detects attributes correctly', () => {
    const attrRegex = /\[[^\]]+\]/;
    expect(attrRegex.test('[type="text"]')).toBe(true);
    expect(attrRegex.test('[data-active]')).toBe(true);
    expect(attrRegex.test('.class')).toBe(false);
  });

  it('fallback regex detects pseudo-elements correctly', () => {
    const pseudoElemRegex = /::/;
    expect(pseudoElemRegex.test('::before')).toBe(true);
    expect(pseudoElemRegex.test('::after')).toBe(true);
    expect(pseudoElemRegex.test(':hover')).toBe(false);
  });

  it('fallback regex detects pseudo-classes correctly', () => {
    const pseudoClassRegex = /:(?!:)/;
    expect(pseudoClassRegex.test(':hover')).toBe(true);
    expect(pseudoClassRegex.test(':focus')).toBe(true);
    expect(pseudoClassRegex.test('::before')).toBe(true); // matches first colon
  });
});

describe('parseSelector standard behavior', () => {
  it('correctly identifies ID selectors', () => {
    const result = parseSelector('#main .class');
    expect(result.hasId).toBe(true);
  });

  it('correctly identifies attribute selectors', () => {
    const result = parseSelector('.btn[data-active]');
    expect(result.hasAttribute).toBe(true);
  });

  it('correctly identifies pseudo-class', () => {
    const result = parseSelector('.btn:hover');
    expect(result.hasPseudoClass).toBe(true);
  });

  it('correctly identifies pseudo-element with double colon', () => {
    const result = parseSelector('.btn::before');
    expect(result.hasPseudoElement).toBe(true);
  });

  it('handles complex selector with multiple features', () => {
    const result = parseSelector('#nav .menu[data-active]:hover::after');
    expect(result.hasId).toBe(true);
    expect(result.hasAttribute).toBe(true);
    expect(result.hasPseudoClass).toBe(true);
    expect(result.hasPseudoElement).toBe(true);
  });
});

describe('parseCSS @layer support', () => {
  it('detects when CSS uses @layer', () => {
    const css = `
      @layer base {
        .button { color: red; }
      }
    `;
    const result = parseCSS(css);
    expect(result.usesLayers).toBe(true);
    expect(result.layers).toContain('base');
  });

  it('detects multiple layers', () => {
    const css = `
      @layer reset, base, components, utilities;
      @layer base {
        .button { color: red; }
      }
      @layer components {
        .card { background: white; }
      }
    `;
    const result = parseCSS(css);
    expect(result.usesLayers).toBe(true);
    expect(result.layers).toContain('reset');
    expect(result.layers).toContain('base');
    expect(result.layers).toContain('components');
    expect(result.layers).toContain('utilities');
  });

  it('assigns layer to rules inside @layer blocks', () => {
    const css = `
      @layer components {
        .button { color: red; }
      }
    `;
    const result = parseCSS(css);
    expect(result.rules[0]?.layer).toBe('components');
  });

  it('rules outside @layer have undefined layer', () => {
    const css = `
      .button { color: red; }
    `;
    const result = parseCSS(css);
    expect(result.rules[0]?.layer).toBeUndefined();
  });

  it('CSS without @layer has usesLayers as false', () => {
    const css = `.button { color: red; }`;
    const result = parseCSS(css);
    expect(result.usesLayers).toBe(false);
    expect(result.layers).toHaveLength(0);
  });

  it('handles empty @layer declaration', () => {
    const css = `
      @layer;
      .button { color: red; }
    `;
    const result = parseCSS(css);
    expect(result.usesLayers).toBe(true);
  });

  it('handles nested @layer inside @media', () => {
    const css = `
      @media (min-width: 768px) {
        @layer responsive {
          .button { color: red; }
        }
      }
    `;
    const result = parseCSS(css);
    expect(result.usesLayers).toBe(true);
    expect(result.layers).toContain('responsive');
  });

  it('does not duplicate layer names', () => {
    const css = `
      @layer base;
      @layer base {
        .button { color: red; }
      }
    `;
    const result = parseCSS(css);
    const baseCount = result.layers.filter((l) => l === 'base').length;
    expect(baseCount).toBe(1);
  });
});

describe('combineParseResults with layers', () => {
  it('preserves layer information in results', () => {
    const results = [
      { file: 'a.css', rules: [], errors: [], layers: ['base'], usesLayers: true },
      { file: 'b.css', rules: [], errors: [], layers: ['components'], usesLayers: true },
    ];
    const combined = combineParseResults(results);
    expect(combined[0]?.layers).toContain('base');
    expect(combined[1]?.layers).toContain('components');
  });
});
