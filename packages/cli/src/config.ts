import * as fs from 'fs/promises';
import * as path from 'path';
import type { AnalyzerConfig } from './core/index.js';

/**
 * Supported config file names
 */
export const CONFIG_FILES = [
  '.csscomplexityrc',
  '.csscomplexityrc.json',
  'csscomplexity.config.json',
  '.csscomplexityrc.yaml',
  '.csscomplexityrc.yml',
];

/**
 * Load configuration from a file
 */
export async function loadConfigFile(filePath: string): Promise<AnalyzerConfig> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    // Simple YAML parsing for basic configs (no nested complex structures)
    return parseSimpleYaml(content);
  }

  // JSON parsing
  return JSON.parse(content) as AnalyzerConfig;
}

/**
 * Simple YAML parser for basic config structures
 */
export function parseSimpleYaml(content: string): AnalyzerConfig {
  const config: AnalyzerConfig = {};
  const lines = content.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;
  let inThresholds = false;
  let inRules = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check for array item
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim().replace(/^['"]|['"]$/g, '');
      if (currentArray && currentKey) {
        currentArray.push(value);
      }
      continue;
    }

    // Check for key: value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      // End previous array if we're starting a new key
      if (currentArray && currentKey) {
        if (currentKey === 'include') config.include = currentArray;
        else if (currentKey === 'exclude') config.exclude = currentArray;
        else if (currentKey === 'ignorePatterns') config.ignorePatterns = currentArray;
        currentArray = null;
        currentKey = null;
      }

      // Check for nested objects
      if (key === 'thresholds') {
        inThresholds = true;
        inRules = false;
        config.thresholds = config.thresholds ?? {};
        continue;
      }

      if (key === 'rules') {
        inRules = true;
        inThresholds = false;
        config.rules = config.rules ?? {};
        continue;
      }

      // Handle nested threshold values
      if (inThresholds && !value && line.startsWith('  ')) {
        continue;
      }

      if (inThresholds && line.startsWith('  ')) {
        const thresholdKey = key as keyof NonNullable<AnalyzerConfig['thresholds']>;
        const numValue = parseInt(value, 10);
        /* istanbul ignore next - defensive null coalescing */
        if (!isNaN(numValue)) {
          config.thresholds = config.thresholds ?? {};
          config.thresholds[thresholdKey] = numValue;
        }
        continue;
      }

      // Handle nested rule values
      if (inRules && line.startsWith('  ')) {
        const ruleKey = key as keyof NonNullable<AnalyzerConfig['rules']>;
        /* istanbul ignore next - defensive null coalescing */
        config.rules = config.rules ?? {};
        config.rules[ruleKey] = value === 'true';
        continue;
      }

      // Top-level keys
      inThresholds = false;
      inRules = false;

      if (!value) {
        // Start of an array
        currentKey = key;
        currentArray = [];
        continue;
      }

      // Simple value
      if (key === 'maxScore') {
        config.maxScore = parseInt(value, 10);
      }
    }
  }

  // Handle final array
  if (currentArray && currentKey) {
    if (currentKey === 'include') config.include = currentArray;
    else if (currentKey === 'exclude') config.exclude = currentArray;
    else if (currentKey === 'ignorePatterns') config.ignorePatterns = currentArray;
  }

  return config;
}

/**
 * Find and load config file from directory
 */
export async function findConfig(directory: string): Promise<AnalyzerConfig | null> {
  const dir = path.resolve(directory);

  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(dir, configFile);
    try {
      await fs.access(configPath);
      return await loadConfigFile(configPath);
    } catch {
      // File doesn't exist, try next
    }
  }

  // Try parent directory (up to root)
  const parentDir = path.dirname(dir);
  if (parentDir !== dir) {
    return findConfig(parentDir);
  }

  return null;
}

/**
 * Generate a default config file
 */
export function generateDefaultConfig(): string {
  const config: Required<AnalyzerConfig> = {
    include: ['**/*.css'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/vendor/**'],
    thresholds: {
      maxSelectorDepth: 4,
      maxSpecificityScore: 40,
      maxImportantPerFile: 5,
      maxDuplicateDeclarations: 3,
    },
    ignorePatterns: [],
    maxScore: 60,
    rules: {
      deepSelectors: true,
      highSpecificity: true,
      importantAbuse: true,
      duplicateDeclarations: true,
      layoutRiskHotspot: true,
      overridePressure: true,
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Write config file to disk
 */
export async function writeConfigFile(
  directory: string,
  filename: string = '.csscomplexityrc.json'
): Promise<string> {
  const configPath = path.join(directory, filename);
  const content = generateDefaultConfig();
  await fs.writeFile(configPath, content, 'utf-8');
  return configPath;
}
