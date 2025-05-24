// Load cache from localStorage (array of [word,data]) or start empty
const stored = JSON.parse(localStorage.getItem('morphoCache') || '[]');
const morphoCache = new Map(stored);

/**
 * Fetches morphological data for a given Greek word, using a persistent cache.
 * On first lookup it proxies the scrape through your local server (/api/lookup),
 * caches the result, persists it, and calls showDefinitionPopup();
 * on subsequent lookups it serves instantly from localStorage.
 */
export async function loadMorphoData(word) {
  // Serve from cache if available and valid
  if (morphoCache.has(word)) {
    const cached = morphoCache.get(word);
    const html = generateMorphoHtml(cached);
    if (!html.includes('No data found')) {
      return cached;
    }
  }
  try {
    const res = await fetch(`http://localhost:3001/api/lookup?word=${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Cache and persist
    morphoCache.set(word, data);
    localStorage.setItem('morphoCache', JSON.stringify([...morphoCache]));
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

// Helper to build HTML from morpho data
export function generateMorphoHtml({ parses = [], definitions = [] }) {
  let html = '';
  if (parses.length) {
    html += '<h3>Parses</h3><ul>';
    parses.forEach(p => {
      html += `<li><strong>${p.lemma}</strong>: ${p.parse}</li>`;
    });
    html += '</ul>';
  }
  if (definitions.length) {
    html += '<h3>Definitions</h3><ul>';
    definitions.forEach(def => {
      html += `<li>${def}</li>`;
    });
    html += '</ul>';
  }
  if (!html) html = '<em>No data found.</em>';
  return html;
}