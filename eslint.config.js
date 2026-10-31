import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// Browser scenarios identify UI through accessible semantics or dedicated test hooks. Check
// DOM queries inside evaluate callbacks too; styling assertions and state filters remain valid.
const browserTestLocators = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unstable:
        'Use getByRole/getByLabel or a dedicated data-testid with getByTestId. Browser-test identity must not depend on CSS classes, inline styles, XPath, parent traversal, or positional CSS selectors.'
    }
  },
  create(context) {
    const methods = new Set(['locator', 'querySelector', 'querySelectorAll', 'closest']);
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') return;
        const property = node.callee.property;
        const method = node.callee.computed ? property.value : property.name;
        if (!methods.has(method)) return;
        const argument = node.arguments[0];
        const fragments =
          argument?.type === 'Literal' && typeof argument.value === 'string'
            ? [argument.value]
            : argument?.type === 'TemplateLiteral'
              ? argument.quasis.map((part) => part.value.cooked ?? part.value.raw)
              : [];
        const unstable = fragments.some((selector) => {
          // Dots inside attribute values (asset URLs, filenames, and accessible names) are text.
          const outsideAttributes = selector.replace(/\[[^\]]*\]/g, '');
          return (
            /\.[_a-zA-Z-]/.test(outsideAttributes) ||
            /\[\s*(class|style)(?:[\s~|^$*=]|\])/i.test(selector) ||
            /xpath\s*=|^\s*(?:\.\.|\/)|:(?:nth|first|last|only)-(?:child|of-type)\b/i.test(selector)
          );
        });
        if (unstable) context.report({ node: argument, messageId: 'unstable' });
      }
    };
  }
};

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser
      }
    }
  },
  {
    files: ['tests/browser/**/*.{ts,mjs}'],
    plugins: { 'browser-tests': { rules: { 'stable-locators': browserTestLocators } } },
    rules: { 'browser-tests/stable-locators': 'error' }
  }
);
