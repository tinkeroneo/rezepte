// Central mutable app state.
// Keep this tiny and explicit so modules can share state without circular import hell.

export const appState = {
  /** @type {boolean} */
  useBackend: false,

  /** @type {any} */
  router: null,

  /** @type {any} */
  repo: null,

  /** @type {any[]} */
  mySpaces: [],

  /** @type {any|null} */
  profileCache: null,

  /** @type {Function|null} */
  viewCleanup: null,

  /** @type {Function|null} */
  dirtyGuard: null,
};
