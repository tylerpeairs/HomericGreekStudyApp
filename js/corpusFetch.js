/**
 * corpusFetch.js
 * Corpus frequency for a Greek word, served by the local Homer index.
 *
 * Not cached. The index answers in about a millisecond, so a cache would only
 * buy a round trip on localhost while creating a way for the UI to show stale
 * results after a rebuild — which is exactly what it did while lookups still
 * went out to ARTFL and Logeion.
 */

/**
 * Fetches lemma frequency in Homer for a word.
 *
 * Book and line are optional but worth passing: they let the server use the
 * treebank's in-context annotation, which disambiguates forms that could
 * belong to more than one lemma.
 *
 * @param {string} word — the Greek word as it appears in the line
 * @param {string|number} [book] — Iliad book number
 * @param {string|number} [line] — line number within that book
 * @returns {Promise<{resultsLength:number, iliad:number, odyssey:number, lemma:string|null, lemmas:Array}>}
 */
export async function fetchHits(word, book, line) {
  const params = new URLSearchParams({ word });
  if (book != null) params.set('book', book);
  if (line != null) params.set('line', line);

  const response = await fetch(`http://localhost:3001/api/hits?${params}`);
  if (!response.ok) {
    throw new Error(`Error fetching hits: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
