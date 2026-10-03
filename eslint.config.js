// Minimal flat ESLint config (ESLint 9). Extend per-package only if a real
// need appears — don't add rules preemptively.
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: ["**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off", // superseded by @typescript-eslint in packages that add it
    },
  },
];
