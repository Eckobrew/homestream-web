import js from '@eslint/js';
import ts from 'typescript-eslint';
// Enforce the modern baseline on extracted playback modules first.
export default [
  { ignores:['node_modules/**','.next/**','src/api/**','src/app/**','src/components/**','src/context/**','src/lib/**','src/types/**','e2e/**','scripts/**','playwright.config.ts','tailwind.config.ts','next-env.d.ts'] },
  { files:['src/player/**/*.ts'],languageOptions:{parser:ts.parser,ecmaVersion:'latest',sourceType:'module'},plugins:{'@typescript-eslint':ts.plugin},rules:{...js.configs.recommended.rules,...ts.configs.recommended.at(-1).rules,'no-undef':'off','no-unused-vars':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]} },
];
