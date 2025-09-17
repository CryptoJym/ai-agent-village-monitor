module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    browser: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    project: [
      "./tsconfig.base.json",
      "./packages/*/tsconfig.json"
    ],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  ignorePatterns: [
    "**/dist/**",
    "**/build/**",
    "**/.vite/**",
    "**/node_modules/**"
  ],
  rules: {
    "react/react-in-jsx-scope": "off"
  },
};

