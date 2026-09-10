import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "tmp/**", "test-results/**", "playwright-report/**"]),
  // The old `next lint` command no longer exists. Keep existing findings visible
  // as warnings while enabling strict rules for all new advertising code.
  { files: ["components/games/*.tsx"], rules: { "react-hooks/set-state-in-effect": "warn" } },
  { files: ["components/LanguageSwitcher.tsx"], rules: { "react-hooks/immutability": "warn" } },
  { files: ["components/UserDashboard.tsx"], rules: { "react-hooks/purity": "warn" } },
  { files: ["components/games/TimelineGame.tsx"], rules: { "prefer-const": "warn" } },
  { files: ["scripts/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
]);
