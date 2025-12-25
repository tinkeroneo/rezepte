import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        localStorage: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-shadow": "error",
      "no-unused-vars": ["error", { args: "none" }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".github/**",
      "**/*.min.js",
    ],
  },
];
