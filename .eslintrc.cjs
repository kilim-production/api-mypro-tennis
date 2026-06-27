module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  ignorePatterns: ["dist", "coverage", "node_modules", "prisma/migrations"],
  rules: {
    "@typescript-eslint/no-namespace": "off"
  }
};
