# CSS Complexity Profiler

[![npm version](https://img.shields.io/npm/v/css-complexity-analyzer.svg)](https://www.npmjs.com/package/css-complexity-analyzer)
[![npm downloads](https://img.shields.io/npm/dm/css-complexity-analyzer.svg)](https://www.npmjs.com/package/css-complexity-analyzer)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/kea0811/css-complexity-analyzer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Analyze CSS complexity - profile cascade, specificity, fragility, and layout risk. Get actionable insights to improve your CSS maintainability.

## Why This Exists

Modern CSS codebases often suffer from:

- **Specificity wars**: Selectors competing with increasingly specific rules, leading to `!important` overuse
- **Cascade complexity**: Unpredictable style overrides across files making debugging difficult
- **Layout fragility**: Brittle positioning rules that break across different viewport sizes
- **Code duplication**: Repeated declarations that should be consolidated into utilities or variables

CSS Complexity Profiler analyzes your stylesheets and provides **actionable recommendations** to reduce technical debt and improve maintainability.

## What It Detects

| Issue | Description |
|-------|-------------|
| `DEEP_SELECTOR` | Selector nesting exceeds threshold (default: 4 levels) |
| `HIGH_SPECIFICITY` | Selector specificity too high or uses IDs |
| `IMPORTANT_ABUSE` | Excessive `!important` declarations |
| `DUPLICATE_DECLARATIONS` | Same property:value repeated many times |
| `LAYOUT_RISK_HOTSPOT` | Rule has many layout-affecting properties |
| `OVERRIDE_PRESSURE` | Property overridden frequently across selectors |
| `MISSING_LAYERS` | Large codebase not using CSS @layer for cascade control |

## Quickstart

```bash
# Analyze CSS files in a directory
npx css-complexity-analyzer analyze ./src

# Check with CI threshold (exit 1 if score > 60)
npx css-complexity-analyzer analyze ./src --max-score 60

# Output as JSON
npx css-complexity-analyzer analyze ./src --format json --out report.json

# Initialize config file
npx css-complexity-analyzer init
```

## Installation

```bash
# npm
npm install -D css-complexity-analyzer

# pnpm
pnpm add -D css-complexity-analyzer

# yarn
yarn add -D css-complexity-analyzer
```

## CLI Usage

### Analyze CSS

```bash
# Analyze current directory
npx css-complexity-analyzer analyze

# Analyze specific path
npx css-complexity-analyzer analyze ./src

# Output JSON report
npx css-complexity-analyzer analyze ./src --format json

# Output Markdown report
npx css-complexity-analyzer analyze ./src --format markdown

# Save report to file
npx css-complexity-analyzer analyze ./src --out report.json
```

### CLI Options

```
Usage: css-complexity-analyzer analyze [options] <path>

Options:
  -f, --format <format>        Output format: text, json, markdown (default: "text")
  -o, --out <file>             Write output to file
  -i, --include <patterns...>  Glob patterns to include (default: ["**/*.css"])
  -e, --exclude <patterns...>  Glob patterns to exclude
  --max-score <n>              Maximum allowed complexity score (exit 1 if exceeded)
  --max-high-severity <n>      Maximum allowed high/critical severity issues
  --silent                     Suppress console output
  -h, --help                   Display help
```

## CI Usage

Add to your CI pipeline to enforce CSS quality:

```yaml
# GitHub Actions example
- name: Check CSS Complexity
  run: npx css-complexity-analyzer analyze ./src --max-score 60 --max-high-severity 0
```

```yaml
# GitLab CI example
css-quality:
  script:
    - npx css-complexity-analyzer analyze ./src --max-score 60
```

The command exits with code 1 if the complexity score exceeds the threshold, failing your CI build.

## Interpreting Output

### Scores (0-100, lower is better)

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 0-20 | Excellent - minimal complexity |
| B | 21-40 | Good - some areas for improvement |
| C | 41-60 | Fair - consider refactoring |
| D | 61-80 | Poor - significant complexity issues |
| F | 81-100 | Critical - major refactoring needed |

### Severity Levels

- **Critical**: Immediate attention required (e.g., multiple ID selectors)
- **High**: Should be fixed soon (e.g., ID usage, very deep selectors)
- **Medium**: Worth addressing (e.g., high specificity, !important on layout)
- **Low**: Minor improvement opportunity

### Category Scores

The overall score is calculated from four weighted categories:

- **Specificity** (30%): Based on max/average specificity and selector depth
- **Cascade** (25%): Based on `!important` usage and override patterns
- **Duplication** (20%): Based on repeated declarations
- **Layout Risk** (25%): Based on layout-affecting property density

## Sample Output

```
CSS Complexity Report
=====================

Overall Score: 45/100 (Grade: C)

Category Scores:
  Specificity:  35/100
  Cascade:      50/100
  Duplication:  40/100
  Layout Risk:  55/100

Top Issues:
  1. [HIGH] High specificity selector (1,2,0)
     File: src/header.css:15
     Selector: #header .nav .menu
     → Replace ID with class selectors

  2. [MEDIUM] Excessive !important usage (12 occurrences)
     File: src/overrides.css
     → Reduce base specificity to avoid !important

  3. [MEDIUM] Duplicate declaration: display: flex (8 times)
     → Extract to a utility class like .d-flex

Files Analyzed: 15
Total Rules: 342
Total Selectors: 567
```

## Programmatic API

```typescript
import { analyzeCSS, analyzeDirectory } from 'css-complexity-analyzer';

// Analyze CSS string
const report = analyzeCSS(`
  .button { color: red; }
  #main .content .wrapper { padding: 10px; }
`);

console.log(report.summary.overallScore); // 0-100 (lower is better)
console.log(report.summary.grade); // A, B, C, D, or F
console.log(report.issues); // Array of detected issues

// Analyze directory
const dirReport = await analyzeDirectory('./src/styles');
```

## Configuration

Create a `.csscomplexityrc.json` file:

```json
{
  "include": ["**/*.css"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/vendor/**"],
  "thresholds": {
    "maxSelectorDepth": 4,
    "maxSpecificityScore": 40,
    "maxImportantPerFile": 5,
    "maxDuplicateDeclarations": 3
  },
  "maxScore": 60,
  "rules": {
    "deepSelectors": true,
    "highSpecificity": true,
    "importantAbuse": true,
    "duplicateDeclarations": true,
    "layoutRiskHotspot": true,
    "overridePressure": true
  }
}
```

Or use YAML format (`.csscomplexityrc.yaml`):

```yaml
include:
  - "**/*.css"
exclude:
  - "**/node_modules/**"
  - "**/dist/**"
thresholds:
  maxSelectorDepth: 4
  maxSpecificityScore: 40
  maxImportantPerFile: 5
  maxDuplicateDeclarations: 3
rules:
  deepSelectors: true
  highSpecificity: true
```

## What To Do Next

After running the analysis, here's how to address common issues:

### Deep Selectors
```css
/* Before: Deep nesting */
.page .content .article .section p { color: #333; }

/* After: Flat, semantic class */
.article-text { color: #333; }
```

### High Specificity
```css
/* Before: ID selector */
#header .nav { background: white; }

/* After: Class selector */
.header-nav { background: white; }
```

### !important Abuse
```css
/* Before: Fighting specificity with !important */
.button { color: white !important; }

/* After: Fix the cascade, remove !important */
.button { color: white; }
```

### Duplicate Declarations
```css
/* Before: Repeated patterns */
.card { display: flex; justify-content: center; }
.modal { display: flex; justify-content: center; }

/* After: Utility class */
.flex-center { display: flex; justify-content: center; }
```

## Test Coverage

This project maintains **100% test coverage** across all packages:

| Package | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| core    | 100%       | 100%     | 100%      | 100%  |
| cli     | 100%       | 100%     | 100%      | 100%  |

Total: **362 tests** covering parsing, metrics, rules, scoring, analysis, CLI, and formatting.

## Roadmap

### v0.5
- HTML mapping mode for selector match analysis
- ~~`@layer` awareness and suggestions~~ ✅ Implemented
- Improved override detection with grouping

### v1
- JSX/TSX class extraction (React/Next)
- HTML report generator
- Git history trend tracking ("complexity increased by X%")

### v2
- Browser runtime analysis
- Computed-style cascade chain analysis
- Per-route reports

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## License

MIT
