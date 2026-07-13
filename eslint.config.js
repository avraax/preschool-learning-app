import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', '*.cjs', '*.js', 'api'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Keep the two classic, high-value hook rules. We intentionally do NOT spread
      // reactHooks.configs.recommended, because in eslint-plugin-react-hooks v6 it also enables the
      // React *Compiler* safety rules (react-hooks/refs, /purity, /set-state-in-effect,
      // /immutability, "accessed before declared"). This app does not use the React Compiler, and
      // those rules flag working, intentional patterns in the audio singletons + instant-load
      // welcome flow — refactoring that battle-tested code to satisfy a compiler we don't run would
      // add risk for no runtime benefit. rules-of-hooks + exhaustive-deps stay on.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
)
