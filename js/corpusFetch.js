/**
 * corpusFetch.js
 * Corpus frequency for a Greek word, served by the local Homer index.
 *
 * The cache key is versioned: entries written before the local index existed
 * hold the zeros the old lemma: search returned for inflected forms, and would
 * otherwise be served forever.
 */
const CACHE_KEY = 'hitsCacheV2';
const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
const hitsCache = new Map(stored);

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
  // Context can change which lemma a form resolves to, so it belongs in the key.
  const cacheKey = book != null && line != null ? `${word}|${book}.${line}` : word;
  if (hitsCache.has(cacheKey)) {
    return hitsCache.get(cacheKey);
  }

  const params = new URLSearchParams({ word });
  if (book != null) params.set('book', book);
  if (line != null) params.set('line', line);

  const response = await fetch(`http://localhost:3001/api/hits?${params}`);
  if (!response.ok) {
    throw new Error(`Error fetching hits: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();

  hitsCache.set(cacheKey, data);
  localStorage.setItem(CACHE_KEY, JSON.stringify([...hitsCache]));
  return data;
}
