import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'client/**'],
  },
  {
    ...js.configs.recommended,
    files: ['server/**/*.js', 'shared/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022 },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_|^next$',
        caughtErrorsIgnorePattern: '^_|^err$|^e$|^logErr$|^error$',
      }],
      'no-useless-assignment': 'warn',
    },
  },
]
