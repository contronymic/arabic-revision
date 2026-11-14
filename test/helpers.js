// Shared test utilities. Nothing here is served to phones as part of the site.
import { readFileSync } from 'node:fs';

// Reads a JSON file relative to the project root.
export function readJson(relPath) {
  return JSON.parse(readFileSync(new URL('../' + relPath, import.meta.url), 'utf8'));
}

// A stand-in for fetch, serving the given files by URL.
// An object is served as JSON; a string is served as a body that is not JSON;
// a missing URL behaves like being offline.
export function fakeFetch(files) {
  return async (url) => {
    if (!(url in files)) throw new TypeError('Failed to fetch');
    const value = files[url];
    return {
      ok: true,
      status: 200,
      json: async () => {
        if (typeof value === 'string') return JSON.parse(value);
        return structuredClone(value);
      },
    };
  };
}
