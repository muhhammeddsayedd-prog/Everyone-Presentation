import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';

export default defineConfig([
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], plugins: { 'react-hooks': hooks, '@next/next': next },
    settings: { next: { rootDir: 'apps/web/' } }, rules: {
      ...hooks.configs.flat.recommended.rules, ...next.configs.recommended.rules,
      '@next/next/no-img-element': 'off'
    }
  },
  globalIgnores(['**/.next/**', '**/.next-e2e/**', '.agents/**', '.claude/**', 'Design Elements/**', '.venv-skills/**', 'apps/web/next-env.d.ts'])
]);
