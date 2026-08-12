import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'FPL Draft/**'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  // Keep last: turns off stylistic rules that would fight Prettier.
  prettierRecommended,
  {
    rules: {
      /*
       * These four are warnings rather than errors because every current
       * violation predates the Next 16 / React 19 upgrade that surfaced them —
       * they are a backlog to work off, not a gate on new work. See
       * `agents/API.md` (untyped upstream payloads) and the "Known issues"
       * section of `agents/ARCHITECTURE.md` for what each one is waiting on.
       * Fix the violations, then promote these back to `error`.
       */
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
];
