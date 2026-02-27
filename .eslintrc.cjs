// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-restricted-globals': ['error', 'Buffer'],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'src/wasm/*/pkg/**', 'docs/**', 'coverage/**'],
  },
);
