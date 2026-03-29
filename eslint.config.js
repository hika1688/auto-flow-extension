import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-test/**',
      '*.zip',
      '.husky/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: 'readonly',
      },
    },
    rules: {
      // Possible errors
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Best practices
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',

      // Code style
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'arrow-spacing': 'error',
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always',
      }],

      // ES6+
      'no-duplicate-imports': 'error',
      'prefer-template': 'error',
    },
  },
  {
    // Test files — allow test globals
    files: ['**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Build scripts — console output is intentional
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
