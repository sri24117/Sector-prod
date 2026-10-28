import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" } },
    rules: {
      "no-unused-vars": "off", // TypeScript checks these separately when configured.
      "no-undef": "off", // TypeScript resolves types, browser globals and Node globals.
    },
  },
];
