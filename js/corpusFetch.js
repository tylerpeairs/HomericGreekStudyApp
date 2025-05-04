// at top of the file, load from storage if present
const stored = JSON.parse(localStorage.getItem('hitsCache') || '[]');
const hitsCache = new Map(stored);


/**
 * Fetches the resultsLength by calling your Puppeteer micro-service.
 * Caches every result in hitsCache so repeat lookups are instant.
 *
 * @param {string} word — the Greek word to look up
 * @returns {Promise<number>}
 */
export async function fetchResultsLength(word) {
  // 1) Check cache first
  if (hitsCache.has(word)) {
    return hitsCache.get(word);
  }

  // 2) Otherwise fetch from service
  const url = `http://localhost:3001/api/hits?word=${encodeURIComponent(word)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error fetching hits: ${response.status} ${response.statusText}`);
  }
  const { resultsLength } = await response.json();

  // 3) Store in cache and return
  hitsCache.set(word, resultsLength);
  localStorage.setItem('hitsCache', JSON.stringify([...hitsCache]) );
  return resultsLength;
}