// src/domain/listQuery.cjs
// CommonJS bridge to the ESM module (listQuery.js)

let modPromise = null;

async function getMod() {
  if (!modPromise) modPromise = import("./listQuery.js");
  return modPromise;
}

module.exports = {
  applyListQuery: async (...args) => (await getMod()).applyListQuery(...args),
  parseMinutes: async (...args) => (await getMod()).parseMinutes(...args),
  sortTitle: async (...args) => (await getMod()).sortTitle(...args),
  defaultDirFor: async (...args) => (await getMod()).defaultDirFor(...args)
};
