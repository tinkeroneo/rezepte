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

        // Web platform
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        Response: "readonly",
        Request: "readonly",
        AbortController: "readonly",
        performance: "readonly",
        crypto: "readonly",
        CSS: "readonly",
        createImageBitmap: "readonly",
        requestAnimationFrame: "readonly",

        // Timers
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",

        // Dialogs
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
      },
    },
    rules: {
      "no-shadow": "error",
      "no-unused-vars": ["error", { args: "none" }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Service Worker globals
    files: ["sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        clients: "readonly",
      },
    },
  },
  {
    ignores: [
      "swtoast/**",
      "dist/**",
      "build/**",
      "node_modules/**",
      ".github/**",
      "**/*.min.js",
    ],
  },
];
