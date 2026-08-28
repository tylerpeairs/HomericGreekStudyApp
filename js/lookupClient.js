/**
 * lookupClient.js
 * Shared transport for the word-lookup endpoints on the local server.
 *
 * Exists mainly to tell two failures apart. A word the index genuinely lacks
 * and a lookup server that is not running used to render identically — the
 * reader saw "N/A" and "No data found" either way, with nothing to say the
 * fix was to start the server.
 */

const LOOKUP_ORIGIN = 'http://localhost:3001';

/** Raised when the lookup server cannot be reached at all. */
export class LookupUnavailableError extends Error {
  constructor(options) {
    super(`Lookup server is not reachable at ${LOOKUP_ORIGIN}`, options);
    this.name = 'LookupUnavailableError';
  }
}

/**
 * Calls a lookup endpoint for a single word.
 *
 * @param {string} path endpoint path, e.g. '/api/hits'
 * @param {string} word the Greek word as it appears in the line
 * @param {string|number} [book] Iliad book number
 * @param {string|number} [line] line number within that book
 * @returns {Promise<object>} the parsed JSON response
 * @throws {LookupUnavailableError} if the server cannot be reached
 */
export async function requestLookup(path, word, book, line) {
  const params = new URLSearchParams({ word });
  if (book != null) params.set('book', book);
  if (line != null) params.set('line', line);

  let response;
  try {
    response = await fetch(`${LOOKUP_ORIGIN}${path}?${params}`);
  } catch (cause) {
    // fetch rejects only on a transport failure. Against localhost that means
    // nothing is listening — a reachable server returning an error still
    // resolves, and is handled below.
    throw new LookupUnavailableError({ cause });
  }
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
