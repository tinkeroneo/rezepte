import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser/Web APIs
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        Response: "readonly",
        fetch: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        requestAnimationFrame: "readonly",
        performance: "readonly",
        crypto: "readonly",
        CSS: "readonly",

        // Service Worker APIs
        self: "readonly",
        caches: "readonly",
      },
    },
    rules: {
      eqeqeq: ["error", "always"],
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        Response: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
  },
];
