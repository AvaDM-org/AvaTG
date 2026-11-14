import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", ".claude"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Tauri commands that return nothing are typed invoke<void>.
      "@typescript-eslint/no-invalid-void-type": "off",
    },
  },
);
