import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';

export default defineConfig([
  js.configs.recommended,
  // Node 24 provides this global to the source-sealed SQL operation tests.
  { files: ['tests/operations/*.mjs'], languageOptions: { globals: { structuredClone: 'readonly' } } },
  // Native supervisors run only in Node, including the credential-free VM.
  { files: ['apps/worker/src/*.mjs'], languageOptions: { globals: {
    process: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly'
  } } },
  ...ts.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], plugins: { 'react-hooks': hooks, '@next/next': next },
    settings: { next: { rootDir: 'apps/web/' } }, rules: {
      ...hooks.configs.flat.recommended.rules, ...next.configs.recommended.rules,
      '@next/next/no-img-element': 'off'
    }
  },
  // Vendored React Bits sources (MIT + Commons Clause) are kept byte-close to upstream so updates stay diffable.
  // Two React Compiler rules flag their ref-mirroring pattern; app code keeps the full rule set.
  { files: ['apps/web/components/motion/bits/**'], rules: { 'react-hooks/refs': 'off', 'react-hooks/set-state-in-effect': 'off' } },
  globalIgnores(['**/.next/**', '**/.next-e2e/**', '.agents/**', '.claude/**', 'Design Elements/**', '.venv-skills/**', 'apps/web/next-env.d.ts'])
]);
