// src/entry.js
// Dedicated browser entrypoint (safe even if other modules import from src/app.js).

import { startApp } from "./app/app.main.js";

startApp();
